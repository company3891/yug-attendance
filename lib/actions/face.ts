'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { parseFormData, actionFail, actionOk, type ActionState } from '@/lib/forms/parse'
import { getCurrentUser } from '@/lib/auth/roles'
import {
  faceRegisterSchema,
  faceResetSchema,
  faceAuthToggleSchema,
  voiceSettingSchema,
} from '@/lib/schemas/face'

// ---------------------------------------------------------------------------
// 顔データ登録（本人のみ）
// ---------------------------------------------------------------------------
export type FaceRegisterState = ActionState<'user_id' | 'descriptors_json' | 'image_consent'>

export async function registerFaceAction(
  _prev: FaceRegisterState,
  formData: FormData,
): Promise<FaceRegisterState> {
  const me = await getCurrentUser()
  if (!me) return actionFail('ログインが必要です')

  const parsed = parseFormData(faceRegisterSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { user_id, descriptors_json, image_consent } = parsed.data

  // 本人のみ登録可能
  if (me.id !== user_id) return actionFail('自分の顔データのみ登録できます')

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('users')
    .update({
      face_descriptors: descriptors_json as never,
      face_image_consent: image_consent,
      face_registered_at: now,
      face_failed_count: 0,
      face_last_failed_at: null,
    } as never)
    .eq('id', user_id)

  if (error) return actionFail(`登録に失敗しました: ${error.message}`)

  // 監査ログ
  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'face.register',
    resource_type: 'users',
    resource_id: user_id,
    auth_method: 'face_register',
    after_data: {
      face_registered_at: now,
      descriptor_count: (descriptors_json as number[][]).length,
      image_consent,
    },
  } as never)

  return actionOk('顔データを登録しました')
}

// ---------------------------------------------------------------------------
// 顔データリセット（管理者 or 本人）
// ---------------------------------------------------------------------------
export type FaceResetState = ActionState<'user_id'>

export async function resetFaceAction(
  _prev: FaceResetState,
  formData: FormData,
): Promise<FaceResetState> {
  const me = await getCurrentUser()
  if (!me) return actionFail('ログインが必要です')

  const parsed = parseFormData(faceResetSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { user_id } = parsed.data

  // 本人または管理者以上のみ
  const canReset = me.id === user_id || ['master', 'store', 'admin'].includes(me.role)
  if (!canReset) return actionFail('権限がありません')

  const admin = createAdminClient()

  // Storage の顔画像も削除（同意して保存した場合）
  const { data: fileList } = await admin.storage.from('face-images').list(user_id)
  if (fileList && fileList.length > 0) {
    const paths = fileList.map((f) => `${user_id}/${f.name}`)
    await admin.storage.from('face-images').remove(paths)
  }

  const { error } = await admin
    .from('users')
    .update({
      face_descriptors: null,
      face_auth_enabled: false,
      face_image_consent: false,
      face_registered_at: null,
      face_failed_count: 0,
      face_last_failed_at: null,
    } as never)
    .eq('id', user_id)

  if (error) return actionFail(`リセットに失敗しました: ${error.message}`)

  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'face.reset',
    resource_type: 'users',
    resource_id: user_id,
    auth_method: 'face_reset',
  } as never)

  return actionOk('顔データをリセットしました')
}

// ---------------------------------------------------------------------------
// 顔認証ON/OFFトグル（管理者 or 本人）
// ---------------------------------------------------------------------------
export type FaceAuthToggleState = ActionState<'user_id' | 'face_auth_enabled'>

export async function toggleFaceAuthAction(
  _prev: FaceAuthToggleState,
  formData: FormData,
): Promise<FaceAuthToggleState> {
  const me = await getCurrentUser()
  if (!me) return actionFail('ログインが必要です')

  const parsed = parseFormData(faceAuthToggleSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { user_id, face_auth_enabled } = parsed.data

  const canEdit = me.id === user_id || ['master', 'store', 'admin'].includes(me.role)
  if (!canEdit) return actionFail('権限がありません')

  const admin = createAdminClient()

  // 顔データが未登録なのに有効にしようとする場合は拒否
  if (face_auth_enabled) {
    const { data: targetUser } = await admin
      .from('users')
      .select('face_descriptors')
      .eq('id', user_id)
      .single()
    if (!(targetUser as { face_descriptors: unknown } | null)?.face_descriptors) {
      return actionFail('顔データが未登録です。先に顔登録を行ってください。')
    }
  }

  const { error } = await admin
    .from('users')
    .update({ face_auth_enabled } as never)
    .eq('id', user_id)

  if (error) return actionFail(`更新に失敗しました: ${error.message}`)

  return actionOk(face_auth_enabled ? '顔認証を有効にしました' : '顔認証を無効にしました')
}

// ---------------------------------------------------------------------------
// 音声読み上げ設定（本人 or 管理者）
// ---------------------------------------------------------------------------
export type VoiceSettingState = ActionState<'user_id' | 'voice_announcement_enabled'>

export async function updateVoiceSettingAction(
  _prev: VoiceSettingState,
  formData: FormData,
): Promise<VoiceSettingState> {
  const me = await getCurrentUser()
  if (!me) return actionFail('ログインが必要です')

  const parsed = parseFormData(voiceSettingSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { user_id, voice_announcement_enabled } = parsed.data

  const canEdit = me.id === user_id || ['master', 'store', 'admin'].includes(me.role)
  if (!canEdit) return actionFail('権限がありません')

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ voice_announcement_enabled } as never)
    .eq('id', user_id)

  if (error) return actionFail(`更新に失敗しました: ${error.message}`)

  return actionOk('音声設定を更新しました')
}

// ---------------------------------------------------------------------------
// 顔認証失敗カウントの更新（/api/clock/face から呼ばれる内部関数）
// ---------------------------------------------------------------------------
export async function incrementFaceFailCount(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('face_failed_count')
    .eq('id', userId)
    .single()

  const newCount = ((data as { face_failed_count: number } | null)?.face_failed_count ?? 0) + 1
  await admin
    .from('users')
    .update({ face_failed_count: newCount, face_last_failed_at: new Date().toISOString() } as never)
    .eq('id', userId)
}

/** 顔認証成功時にカウントをリセット */
export async function resetFaceFailCount(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('users')
    .update({ face_failed_count: 0, face_last_failed_at: null } as never)
    .eq('id', userId)
}

// ---------------------------------------------------------------------------
// ボタン打刻 Server Action（ダッシュボードから呼ぶ）
// ---------------------------------------------------------------------------
import { z } from 'zod'
import { decideClockEvent, type AttendanceSnapshot } from '@/lib/clockLogic'
import { calcWorkTimeBreakdown, resolveWorkDate, type DayType } from '@/lib/workTime'
import { extractLastName, resolveVoiceEnabled, type ClockEventType } from '@/lib/speech'

const buttonClockSchema = z.object({
  event_type: z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
})

export type ButtonClockState = ActionState<'event_type'>

export type ButtonClockResult =
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<'event_type', string[]>> }
  | {
      ok: true
      message?: string
      event: ClockEventType
      labor_minutes: number | null
      work_date: string
      voice: { enabled: boolean; lastName: string }
    }

export async function buttonClockAction(
  _prev: ButtonClockState,
  formData: FormData,
): Promise<ButtonClockResult> {
  const me = await getCurrentUser()
  if (!me) return actionFail('ログインが必要です')

  const parsed = parseFormData(buttonClockSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { event_type } = parsed.data
  const admin = createAdminClient()

  // 店舗情報取得
  const { data: store } = await admin
    .from('stores')
    .select('id, day_start_time, midnight_start_time, midnight_end_time, scheduled_daily_minutes, voice_announcement_default')
    .eq('id', me.store_id!)
    .single()

  if (!store) return actionFail('所属店舗が見つかりません')

  const now = new Date()
  const dayStartTime = (store as { day_start_time: string }).day_start_time ?? '00:00'
  const workDate = resolveWorkDate(now, dayStartTime)

  // 当日レコード取得
  const { data: todayRow } = await admin
    .from('attendances')
    .select('id, user_id, work_date, clock_in, clock_out')
    .eq('user_id', me.id)
    .eq('work_date', workDate)
    .maybeSingle()

  // 直前打刻イベント取得
  const { data: lastRows } = await admin
    .from('attendances')
    .select('clock_in, clock_out')
    .eq('user_id', me.id)
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

  // break_start / break_end は event_type を clock_in / clock_out にマッピングして判定
  const clockEventType = event_type === 'break_start' || event_type === 'break_end'
    ? (event_type === 'break_start' ? 'clock_in' : 'clock_out')
    : event_type

  const decision = decideClockEvent({
    now,
    dayStartTime,
    todayRecord: (todayRow as unknown as AttendanceSnapshot | null) ?? null,
    lastEventAt,
  })

  // break_start / break_end は休憩テーブルを使う想定だが Phase 5 未実装
  // ここでは出勤/退勤のみ対応、break は仮応答
  if (event_type === 'break_start' || event_type === 'break_end') {
    // Phase 5 で休憩テーブルと連携予定。現時点では成功応答のみ返す
    const lastName = extractLastName(me.name)
    const storeDefault = (store as { voice_announcement_default: boolean }).voice_announcement_default
    const voiceEnabled = resolveVoiceEnabled(
      (me as { voice_announcement_enabled?: boolean | null }).voice_announcement_enabled,
      storeDefault,
    )
    return {
      ok: true,
      event: event_type as ClockEventType,
      labor_minutes: null,
      work_date: workDate,
      voice: { enabled: voiceEnabled, lastName },
    }
  }

  if (decision.kind === 'reject') {
    const messages: Record<string, string> = {
      CLOCK_TOO_FREQUENT: '直前の打刻から1分経っていません',
      CLOCK_ALREADY_CLOSED: '本日の出退勤は既に完了しています',
    }
    return actionFail(messages[decision.code] ?? decision.code)
  }

  const userId = me.id
  let labor_minutes: number | null = null

  if (decision.kind === 'clock_in') {
    if (clockEventType !== 'clock_in') {
      return actionFail('現在の状態では出勤打刻のみ可能です')
    }
    const { error: insErr } = await admin
      .from('attendances')
      .insert({
        user_id: userId,
        store_id: me.store_id!,
        work_date: workDate,
        clock_in: now.toISOString(),
        method: 'manual',  // ボタン打刻は method='manual' で記録
        has_anomaly: false,
        anomaly_codes: [],
      } as never)
    if (insErr) return actionFail(`出勤記録に失敗: ${insErr.message}`)
  } else {
    // clock_out
    if (clockEventType !== 'clock_out') {
      return actionFail('現在の状態では退勤打刻のみ可能です')
    }
    const clockInAt = new Date((todayRow as unknown as AttendanceSnapshot).clock_in!)
    if (now.getTime() < clockInAt.getTime()) {
      return actionFail('退勤時刻が出勤時刻より前になっています')
    }

    const dayType: DayType = 'workday'
    const breakdown = calcWorkTimeBreakdown({
      clockIn: clockInAt,
      clockOut: now,
      breakMinutes: 0,
      scheduledMinutes:
        (store as { scheduled_daily_minutes: number }).scheduled_daily_minutes ?? 480,
      dayType,
    })
    labor_minutes = breakdown.laborMinutes

    const { error: updErr } = await admin
      .from('attendances')
      .update({
        clock_out: now.toISOString(),
        has_anomaly: breakdown.hasAnomaly,
        anomaly_codes: breakdown.anomalyCodes,
      } as never)
      .eq('id', decision.attendanceId)
    if (updErr) return actionFail(`退勤記録に失敗: ${updErr.message}`)

    await admin.from('work_time_calculations').upsert({
      attendance_id: decision.attendanceId,
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
  }

  // 監査ログ
  await admin.from('audit_logs').insert({
    actor_id: userId,
    action: `attendance.${event_type}`,
    resource_type: 'attendances',
    auth_method: 'button',
    after_data: { work_date: workDate, clocked_at: now.toISOString() },
  } as never)

  const lastName = extractLastName(me.name)
  const storeDefault = (store as { voice_announcement_default: boolean }).voice_announcement_default
  const voiceEnabled = resolveVoiceEnabled(
    (me as { voice_announcement_enabled?: boolean | null }).voice_announcement_enabled,
    storeDefault,
  )

  return {
    ok: true,
    event: event_type as ClockEventType,
    labor_minutes,
    work_date: workDate,
    voice: { enabled: voiceEnabled, lastName },
  }
}
