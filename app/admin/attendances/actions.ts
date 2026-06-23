'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { actionFail, actionOk, parseFormData, type ActionState } from '@/lib/forms/parse'
import { attendanceUpdateSchema } from '@/lib/schemas/attendance'
import { jstLocalToDate } from '@/lib/datetime'
import { calcWorkTimeBreakdown, type DayType } from '@/lib/workTime'
import { canEditAttendance } from '@/lib/permissions/attendance'

export type AttendanceEditState = ActionState<'clock_in' | 'clock_out' | 'break_minutes'>

/**
 * 打刻修正（Phase 4 / Day 1）
 *
 * 権限: master / store / admin（employee 不可）。store/admin は自店舗のみ、master は全店舗。
 * 流れ:
 *   1. requireRole('admin') で employee を除外
 *   2. 対象 attendance を取得（before）
 *   3. 店舗スコープ検証（master 以外は自店舗のみ）
 *   4. JST→UTC 変換 + 未来時刻禁止検証
 *   5. attendances UPDATE（modified_by / modified_at も記録）
 *   6. work_time_calculations 再計算（lib/workTime.ts 再利用、dayType は打刻ルートと同じ 'workday' 固定）
 *   7. audit_logs 記録（action='attendance.edit', auth_method='manual_edit'）
 */
export async function updateAttendanceAction(
  attendanceId: string,
  formData: FormData,
): Promise<AttendanceEditState> {
  const me = await requireRole('admin')

  const parsed = parseFormData(attendanceUpdateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const admin = createAdminClient()

  // --- 2. before 取得 ---
  const { data: before, error: fetchErr } = await admin
    .from('attendances')
    .select('id, user_id, store_id, work_date, clock_in, clock_out, break_minutes')
    .eq('id', attendanceId)
    .single()
  if (fetchErr || !before) {
    return actionFail('対象の打刻レコードが見つかりません')
  }
  const beforeRow = before as {
    id: string
    user_id: string
    store_id: string
    work_date: string
    clock_in: string | null
    clock_out: string | null
    break_minutes: number
  }

  // --- 3. 店舗スコープ（master 以外は自店舗のみ）---
  if (
    !canEditAttendance({
      actorRole: me.role,
      actorStoreId: me.store_id,
      targetStoreId: beforeRow.store_id,
    })
  ) {
    return actionFail('他店舗の打刻は修正できません')
  }

  // --- 4. JST→UTC 変換 + 未来時刻禁止 ---
  const clockInAt = jstLocalToDate(parsed.data.clock_in)
  const clockOutAt = parsed.data.clock_out ? jstLocalToDate(parsed.data.clock_out) : null
  const breakMinutes = parsed.data.break_minutes ?? beforeRow.break_minutes ?? 0
  const now = new Date()
  if (clockInAt.getTime() > now.getTime()) {
    return { ok: false, fieldErrors: { clock_in: ['未来の時刻は指定できません'] } }
  }
  if (clockOutAt && clockOutAt.getTime() > now.getTime()) {
    return { ok: false, fieldErrors: { clock_out: ['未来の時刻は指定できません'] } }
  }
  // clock_out > clock_in は schema でも検証済みだが、変換後の最終ガード
  if (clockOutAt && clockOutAt.getTime() <= clockInAt.getTime()) {
    return { ok: false, fieldErrors: { clock_out: ['退勤時刻は出勤時刻より後にしてください'] } }
  }

  // --- 6. 再計算（退勤が揃っている場合のみ）---
  // 店舗の所定時間を取得（深夜帯は打刻ルートと同様デフォルト 22:00-05:00 を使用）
  const { data: store } = await admin
    .from('stores')
    .select('scheduled_daily_minutes')
    .eq('id', beforeRow.store_id)
    .single()
  const scheduledMinutes =
    (store as { scheduled_daily_minutes: number } | null)?.scheduled_daily_minutes ?? 480

  let hasAnomaly = false
  let anomalyCodes: string[] = []
  let wtc: {
    labor_minutes: number
    scheduled_minutes: number
    over_scheduled_minutes: number
    over_legal_minutes: number
    midnight_minutes: number
    midnight_over_minutes: number
    holiday_minutes: number
    holiday_over_minutes: number
  } | null = null

  if (clockOutAt) {
    const dayType: DayType = 'workday' // Phase 6 の年間カレンダー実装まで打刻ルートと同じく固定
    const breakdown = calcWorkTimeBreakdown({
      clockIn: clockInAt,
      clockOut: clockOutAt,
      breakMinutes,
      scheduledMinutes,
      dayType,
    })
    hasAnomaly = breakdown.hasAnomaly
    anomalyCodes = breakdown.anomalyCodes
    wtc = {
      labor_minutes: breakdown.laborMinutes,
      scheduled_minutes: breakdown.scheduledMinutes,
      over_scheduled_minutes: breakdown.overScheduledMinutes,
      over_legal_minutes: breakdown.overLegalMinutes,
      midnight_minutes: breakdown.midnightMinutes,
      midnight_over_minutes: breakdown.midnightOverMinutes,
      holiday_minutes: breakdown.holidayMinutes,
      holiday_over_minutes: breakdown.holidayOverMinutes,
    }
  }

  // --- 5. attendances UPDATE ---
  const { error: updErr } = await admin
    .from('attendances')
    .update({
      clock_in: clockInAt.toISOString(),
      clock_out: clockOutAt ? clockOutAt.toISOString() : null,
      break_minutes: breakMinutes,
      has_anomaly: hasAnomaly,
      anomaly_codes: anomalyCodes,
      modified_by: me.id,
      modified_at: now.toISOString(),
    } as never)
    .eq('id', attendanceId)
  if (updErr) return actionFail(updErr.message)

  // --- 6b. work_time_calculations upsert（退勤がある場合のみ。未退勤なら 0 にリセット）---
  const { error: wtcErr } = await admin.from('work_time_calculations').upsert(
    {
      attendance_id: attendanceId,
      labor_minutes: wtc?.labor_minutes ?? 0,
      scheduled_minutes: wtc?.scheduled_minutes ?? scheduledMinutes,
      over_scheduled_minutes: wtc?.over_scheduled_minutes ?? 0,
      over_legal_minutes: wtc?.over_legal_minutes ?? 0,
      midnight_minutes: wtc?.midnight_minutes ?? 0,
      midnight_over_minutes: wtc?.midnight_over_minutes ?? 0,
      holiday_minutes: wtc?.holiday_minutes ?? 0,
      holiday_over_minutes: wtc?.holiday_over_minutes ?? 0,
      calculated_at: now.toISOString(),
    } as never,
    { onConflict: 'attendance_id' },
  )
  if (wtcErr) return actionFail(wtcErr.message)

  // --- 7. audit_logs 記録 ---
  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'attendance.edit',
    resource_type: 'attendances',
    resource_id: attendanceId,
    before_data: {
      clock_in: beforeRow.clock_in,
      clock_out: beforeRow.clock_out,
      break_minutes: beforeRow.break_minutes,
    },
    after_data: {
      clock_in: clockInAt.toISOString(),
      clock_out: clockOutAt ? clockOutAt.toISOString() : null,
      break_minutes: breakMinutes,
    },
    auth_method: 'manual_edit',
  } as never)

  revalidatePath('/admin/attendances')
  return actionOk('打刻を修正しました')
}
