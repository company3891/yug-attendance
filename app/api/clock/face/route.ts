/**
 * POST /api/clock/face
 *
 * 顔認証打刻 API。クライアント側で顔比較済みのため、
 * ここでは打刻処理（出退勤判定 + DB書込み）のみ行う。
 *
 * セキュリティ:
 * - ログイン必須
 * - user_id はセッションから取得（リクエストボディの user_id はバリデーション用）
 * - 連続打刻防止（decideClockEvent による 60秒制限）
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { translateError, type ErrorCode } from '@/lib/errors/translate'
import { decideClockEvent, type AttendanceSnapshot, type ClockRejectCode } from '@/lib/clockLogic'
import { calcWorkTimeBreakdown, resolveWorkDate } from '@/lib/workTime'
import { resolveDayCalcSettings } from '@/lib/settings/server'

const faceClockBodySchema = z.object({
  user_id: z.string().uuid(),
  store_id: z.string().uuid(),
})

const STATUS_BY_CODE: Record<string, number> = {
  CLOCK_TOO_FREQUENT: 429,
  CLOCK_ALREADY_CLOSED: 422,
  CLOCK_OUT_BEFORE_IN: 422,
  USER_NOT_FOUND: 404,
  USER_INACTIVE: 403,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
  VALIDATION_FAILED: 400,
}

function errJson(code: ErrorCode | ClockRejectCode | string, customMessage?: string) {
  const status = STATUS_BY_CODE[code] ?? 400
  return NextResponse.json(
    { ok: false, code, message: customMessage ?? translateError(code as ErrorCode) },
    { status },
  )
}

export async function POST(request: NextRequest) {
  try {
    // ---- 1) 認証 ----
    const supabase = createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return errJson('UNAUTHORIZED')

    // ---- 2) リクエスト検証 ----
    let body: z.infer<typeof faceClockBodySchema>
    try {
      const json = await request.json()
      const parsed = faceClockBodySchema.safeParse(json)
      if (!parsed.success) return errJson('VALIDATION_FAILED')
      body = parsed.data
    } catch {
      return errJson('VALIDATION_FAILED')
    }

    // 本人確認（セッションユーザーと一致）
    if (authUser.id !== body.user_id) {
      return errJson('FORBIDDEN', '他のユーザーの代理打刻はできません')
    }

    const admin = createAdminClient()

    // ---- 3) ユーザー・店舗情報取得 ----
    const { data: targetUser } = await admin
      .from('users')
      .select('id, store_id, is_active, name, face_auth_enabled, face_descriptors, face_failed_count')
      .eq('id', body.user_id)
      .single()

    if (!targetUser) return errJson('USER_NOT_FOUND')
    if (!(targetUser as { is_active: boolean }).is_active) return errJson('USER_INACTIVE')

    // 店舗一致確認
    if ((targetUser as { store_id: string | null }).store_id !== body.store_id) {
      return errJson('FORBIDDEN', '所属店舗と異なる店舗での打刻はできません')
    }

    const { data: store } = await admin
      .from('stores')
      .select('id, day_start_time, company_id')
      .eq('id', body.store_id)
      .single()
    if (!store) return errJson('INTERNAL_ERROR', '店舗情報が取得できません')

    // ---- 4) 出退勤判定 ----
    const now = new Date()
    const dayStartTime = (store as { day_start_time: string }).day_start_time ?? '00:00'
    const workDate = resolveWorkDate(now, dayStartTime)

    const { data: todayRow } = await admin
      .from('attendances')
      .select('id, user_id, work_date, clock_in, clock_out')
      .eq('user_id', body.user_id)
      .eq('work_date', workDate)
      .maybeSingle()

    const { data: lastRows } = await admin
      .from('attendances')
      .select('clock_in, clock_out')
      .eq('user_id', body.user_id)
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
      if (candidates.length > 0) lastEventAt = new Date(candidates[0]!)
    }

    const decision = decideClockEvent({
      now,
      dayStartTime,
      todayRecord: (todayRow as unknown as AttendanceSnapshot | null) ?? null,
      lastEventAt,
    })

    if (decision.kind === 'reject') return errJson(decision.code)

    // ---- 5) DB 書込み ----
    const userId = body.user_id

    if (decision.kind === 'clock_in') {
      const { data: inserted, error: insErr } = await admin
        .from('attendances')
        .insert({
          user_id: userId,
          store_id: body.store_id,
          work_date: workDate,
          clock_in: now.toISOString(),
          method: 'face',
          has_anomaly: false,
          anomaly_codes: [],
        } as never)
        .select('id')
        .single()
      if (insErr || !inserted) return errJson('INTERNAL_ERROR', insErr?.message)

      // 顔認証成功 → failCount リセット
      await admin
        .from('users')
        .update({ face_failed_count: 0, face_last_failed_at: null } as never)
        .eq('id', userId)

      // 監査ログ
      await admin.from('audit_logs').insert({
        actor_id: userId,
        action: 'attendance.clock_in',
        resource_type: 'attendances',
        resource_id: (inserted as { id: string }).id,
        auth_method: 'face',
        after_data: { work_date: workDate, clocked_at: now.toISOString() },
      } as never)

      return NextResponse.json({
        ok: true,
        event: 'clock_in',
        attendance_id: (inserted as { id: string }).id,
        user: { id: userId, name: (targetUser as { name: string }).name },
        work_date: workDate,
        clocked_at: now.toISOString(),
        labor_minutes: null,
      })
    }

    // clock_out
    const clockInAt = new Date((todayRow as unknown as AttendanceSnapshot).clock_in!)
    if (now.getTime() < clockInAt.getTime()) return errJson('CLOCK_OUT_BEFORE_IN')

    // 所定・日種別を台帳から解決（Phase 5）
    const { scheduledMinutes, dayType } = await resolveDayCalcSettings(admin, {
      companyId: (store as { company_id: string }).company_id,
      storeId: (store as { id: string }).id,
      userId: body.user_id,
      workDate,
    })
    const breakdown = calcWorkTimeBreakdown({
      clockIn: clockInAt,
      clockOut: now,
      breakMinutes: 0,
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

    await admin.from('work_time_calculations').upsert({
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
    } as never, { onConflict: 'attendance_id' })

    // failCount リセット + 監査ログ
    await admin
      .from('users')
      .update({ face_failed_count: 0, face_last_failed_at: null } as never)
      .eq('id', userId)

    await admin.from('audit_logs').insert({
      actor_id: userId,
      action: 'attendance.clock_out',
      resource_type: 'attendances',
      resource_id: attendanceId,
      auth_method: 'face',
      after_data: { work_date: workDate, clocked_at: now.toISOString() },
    } as never)

    return NextResponse.json({
      ok: true,
      event: 'clock_out',
      attendance_id: attendanceId,
      user: { id: userId, name: (targetUser as { name: string }).name },
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
