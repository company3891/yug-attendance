/**
 * POST /api/clock
 *
 * QR 打刻 API。
 *
 * フロー:
 *   1. リクエスト zod 検証
 *   2. ログインユーザー取得（認証必須）
 *   3. 店舗（payload の store_id）取得 → qr_secret 取り出し
 *   4. QR 署名検証 (verifyQrSignature)
 *   5. ビジネス検証 (verifyBusinessRules) — user.is_active / qr_revoked_at / qr_version / store_id 一致
 *   6. ログインユーザーと payload.user_id 一致確認（他人の QR では打刻不可）
 *   7. 当日 attendance + 直前打刻イベント取得
 *   8. 出退勤判定 (decideClockEvent) — 連続打刻防止 / 3回目拒否 含む
 *   9. attendance を INSERT or UPDATE
 *   10. 退勤の場合 calcWorkTimeBreakdown で集計 → work_time_calculations へ upsert
 *   11. 成功レスポンス
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { parseFormData } from '@/lib/forms/parse'
import { clockRequestSchema, type ClockRequest } from '@/lib/schemas/clock'
import { errorResponse, translateError, type ErrorCode } from '@/lib/errors/translate'
import { verifyQrSignature, verifyBusinessRules } from '@/lib/qr/verifier'
import {
  decideClockEvent,
  type AttendanceSnapshot,
  type ClockRejectCode,
} from '@/lib/clockLogic'
import { calcWorkTimeBreakdown, resolveWorkDate } from '@/lib/workTime'
import { resolveDayCalcSettings } from '@/lib/settings/server'

// HTTP ステータスとエラーコードのマッピング
const STATUS_BY_CODE: Record<string, number> = {
  CLOCK_TOO_FREQUENT: 429,
  CLOCK_ALREADY_CLOSED: 422,
  CLOCK_OUT_BEFORE_IN: 422,
  QR_INVALID_FORMAT: 400,
  QR_INVALID_SIGNATURE: 400,
  QR_REVOKED: 401,
  QR_VERSION_MISMATCH: 401,
  USER_NOT_FOUND: 404,
  USER_INACTIVE: 403,
  STORE_MISMATCH: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
  VALIDATION_FAILED: 400,
}

function errJson(code: ErrorCode | ClockRejectCode | string, customMessage?: string) {
  const status = STATUS_BY_CODE[code] ?? 400
  return NextResponse.json(
    {
      ok: false,
      code,
      message: customMessage ?? translateError(code as ErrorCode),
    },
    { status },
  )
}

export async function POST(request: NextRequest) {
  try {
    // ---- 1) リクエスト検証 ----
    let body: ClockRequest
    try {
      // JSON ボディと FormData ボディの両方を受ける
      const ct = request.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        const json = await request.json()
        const parsed = clockRequestSchema.safeParse(json)
        if (!parsed.success) {
          return NextResponse.json(
            {
              ok: false,
              code: 'VALIDATION_FAILED',
              message: translateError('VALIDATION_FAILED'),
              fieldErrors: parsed.error.flatten().fieldErrors,
            },
            { status: 400 },
          )
        }
        body = parsed.data
      } else {
        const form = await request.formData()
        const parsed = parseFormData(clockRequestSchema, form)
        if (!parsed.ok) {
          return NextResponse.json(
            {
              ok: false,
              code: 'VALIDATION_FAILED',
              message: translateError('VALIDATION_FAILED'),
              fieldErrors: parsed.fieldErrors,
            },
            { status: 400 },
          )
        }
        body = parsed.data
      }
    } catch {
      return errJson('VALIDATION_FAILED')
    }

    // ---- 2) 認証 ----
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return errJson('UNAUTHORIZED')

    // ---- 3) 店舗取得 (service_role で取得、qr_secret はサーバー内のみ) ----
    const admin = createAdminClient()
    const { data: store, error: storeErr } = await admin
      .from('stores')
      .select('id, qr_secret, day_start_time, midnight_start_time, midnight_end_time, company_id')
      .eq('id', body.store_id)
      .single()
    if (storeErr || !store) return errJson('STORE_MISMATCH')

    // ---- 4) 署名検証 ----
    const sigResult = verifyQrSignature(body.token, (store as { qr_secret: string }).qr_secret)
    if (!sigResult.ok) return errJson(sigResult.code)

    // ---- 5) ユーザー取得 + ビジネス検証 ----
    const { data: targetUser } = await admin
      .from('users')
      .select('id, store_id, is_active, qr_version, qr_revoked_at, qr_issued_at, name')
      .eq('id', sigResult.payload.user_id)
      .single()

    const businessResult = verifyBusinessRules(
      sigResult.payload,
      targetUser as never, // 型整合は generated 型で取れているが never 経由でランタイム一致
      { id: (store as { id: string }).id, qr_secret: (store as { qr_secret: string }).qr_secret },
    )
    if (!businessResult.ok) return errJson(businessResult.code)

    // ---- 6) 本人確認（他人のQRで自分のセッションは不可） ----
    if (authUser.id !== sigResult.payload.user_id) {
      return errJson('FORBIDDEN', '他の従業員のQRコードでは打刻できません。')
    }

    const userId = authUser.id
    const now = new Date()
    const dayStartTime = (store as { day_start_time: string }).day_start_time ?? '00:00'
    const workDate = resolveWorkDate(now, dayStartTime)

    // ---- 7) 当日レコード + 直前イベント取得 ----
    const { data: todayRow } = await admin
      .from('attendances')
      .select('id, user_id, work_date, clock_in, clock_out')
      .eq('user_id', userId)
      .eq('work_date', workDate)
      .maybeSingle()

    const { data: lastRows } = await admin
      .from('attendances')
      .select('clock_in, clock_out')
      .eq('user_id', userId)
      .order('clock_in', { ascending: false, nullsFirst: false })
      .limit(1)

    let lastEventAt: Date | null = null
    const lastRow = (lastRows ?? [])[0] as
      | { clock_in: string | null; clock_out: string | null }
      | undefined
    if (lastRow) {
      const candidates = [lastRow.clock_out, lastRow.clock_in].filter(
        (v): v is string => typeof v === 'string',
      )
      if (candidates.length > 0) {
        lastEventAt = new Date(candidates[0]!)
      }
    }

    // ---- 8) 出退勤判定 ----
    const decision = decideClockEvent({
      now,
      dayStartTime,
      todayRecord: (todayRow as unknown as AttendanceSnapshot | null) ?? null,
      lastEventAt,
    })

    if (decision.kind === 'reject') {
      return errJson(decision.code)
    }

    // ---- 9) DB 反映 ----
    if (decision.kind === 'clock_in') {
      const insertRow = {
        user_id: userId,
        store_id: body.store_id,
        work_date: workDate,
        clock_in: now.toISOString(),
        method: body.method,
        location_lat: body.location_lat ?? null,
        location_lng: body.location_lng ?? null,
        has_anomaly: false,
        anomaly_codes: [],
      }
      const { data: inserted, error: insErr } = await admin
        .from('attendances')
        .insert(insertRow as never)
        .select('id')
        .single()
      if (insErr || !inserted) return errJson('INTERNAL_ERROR', insErr?.message)

      return NextResponse.json({
        ok: true,
        event: 'clock_in',
        attendance_id: (inserted as { id: string }).id,
        user: { id: userId, name: (targetUser as { name: string } | null)?.name ?? '' },
        work_date: workDate,
        clocked_at: now.toISOString(),
        labor_minutes: null,
      })
    }

    // clock_out
    const clockInAt = new Date((todayRow as unknown as AttendanceSnapshot).clock_in!)
    // 異常検知: clock_out < clock_in（API 層で 422 拒否）
    if (now.getTime() < clockInAt.getTime()) {
      return errJson('CLOCK_OUT_BEFORE_IN')
    }

    // labor 計算: 所定・日種別を work_rules/holiday_settings 台帳から解決（Phase 5）
    const { scheduledMinutes, dayType } = await resolveDayCalcSettings(admin, {
      companyId: (store as { company_id: string }).company_id,
      storeId: (store as { id: string }).id,
      userId,
      workDate,
    })
    const breakdown = calcWorkTimeBreakdown({
      clockIn: clockInAt,
      clockOut: now,
      breakMinutes: 0, // Phase 5 で休憩明細導入時に変更
      scheduledMinutes,
      dayType,
    })

    const attendanceId = decision.attendanceId
    const { error: updErr } = await admin
      .from('attendances')
      .update({
        clock_out: now.toISOString(),
        has_anomaly: breakdown.hasAnomaly,
        anomaly_codes: breakdown.anomalyCodes,
      } as never)
      .eq('id', attendanceId)
    if (updErr) return errJson('INTERNAL_ERROR', updErr.message)

    // work_time_calculations upsert
    const { error: wtcErr } = await admin
      .from('work_time_calculations')
      .upsert(
        {
          attendance_id: attendanceId,
          labor_minutes: breakdown.laborMinutes,
          scheduled_minutes: breakdown.scheduledMinutes,
          over_scheduled_minutes: breakdown.overScheduledMinutes,
          over_legal_minutes: breakdown.overLegalMinutes,
          midnight_minutes: breakdown.midnightMinutes,
          midnight_over_minutes: breakdown.midnightOverMinutes,
          holiday_minutes: breakdown.holidayMinutes,
          holiday_over_minutes: breakdown.holidayOverMinutes,
          calculated_at: now.toISOString(),
        } as never,
        { onConflict: 'attendance_id' },
      )
    if (wtcErr) return errJson('INTERNAL_ERROR', wtcErr.message)

    return NextResponse.json({
      ok: true,
      event: 'clock_out',
      attendance_id: attendanceId,
      user: { id: userId, name: (targetUser as { name: string } | null)?.name ?? '' },
      work_date: workDate,
      clocked_at: now.toISOString(),
      labor_minutes: breakdown.laborMinutes,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, code: 'INTERNAL_ERROR', message: translateError('INTERNAL_ERROR'), detail: msg },
      { status: 500 },
    )
  }
}
