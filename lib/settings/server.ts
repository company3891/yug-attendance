/**
 * 設定リゾルバ層（サーバ専用・Phase 5）
 *
 * 責務の境界（設計指示書 注意点③）:
 * - **この層だけが settings 系テーブル（work_rules / holiday_settings / japan_holidays /
 *   users.daily_work_minutes）に DB アクセスする。**
 * - 解決ロジック自体は純関数（lib/calendar/dayType, lib/settings/workRules）に委譲する。
 *
 * 勤怠計算の各経路（QR打刻 / 顔打刻 / 打刻修正）は本関数を呼び、得た
 * { scheduledMinutes, dayType } を calcWorkTimeBreakdown に渡す。これにより
 * dayType='workday' 固定と所定の直読みを一掃し、台帳由来の数値に統一する。
 */

import type { createAdminClient } from '@/lib/supabase/server'
import type { DayType } from '@/lib/workTime'
import { resolveDayType } from '@/lib/calendar/dayType'
import {
  resolveWorkRule,
  effectiveScheduledMinutes,
  type WorkRuleRow,
} from '@/lib/settings/workRules'

type SettingsClient = ReturnType<typeof createAdminClient>

export interface ResolvedDayCalcSettings {
  /** 実効の所定労働時間（分）= 個人別上書き優先、無ければ work_rule、無ければ480 */
  scheduledMinutes: number
  /** 台帳由来の日種別 */
  dayType: DayType
}

/**
 * 勤務日 workDate・店舗 storeId（会社 companyId）・従業員 userId に対する
 * 計算用設定（所定労働時間・日種別）を台帳から解決する。
 *
 * 設定行が一切無い場合でも安全側の既定（所定480 / workday）で返す。
 */
export async function resolveDayCalcSettings(
  supabase: SettingsClient,
  args: { companyId: string; storeId: string; userId: string; workDate: string },
): Promise<ResolvedDayCalcSettings> {
  const { companyId, storeId, userId, workDate } = args

  // --- work_rules（会社の全行 = 会社デフォルト + 配下店舗の上書き）---
  const { data: wrRows } = await supabase
    .from('work_rules')
    .select('scope, company_id, store_id, effective_from, scheduled_minutes, work_start, work_end, break_minutes')
    .eq('company_id', companyId)
  const workRule = resolveWorkRule((wrRows ?? []) as WorkRuleRow[], { date: workDate, storeId })

  // --- 個人別所定上書き（既存 users.daily_work_minutes を流用）---
  const { data: userRow } = await supabase
    .from('users')
    .select('daily_work_minutes')
    .eq('id', userId)
    .maybeSingle()
  const overrideMinutes = (userRow as { daily_work_minutes: number | null } | null)?.daily_work_minutes ?? null

  const scheduledMinutes = effectiveScheduledMinutes(workRule, overrideMinutes)

  // --- holiday_settings（store 優先・company フォールバック）---
  const { data: hsRows } = await supabase
    .from('holiday_settings')
    .select('scope, store_id, scheduled_holidays, legal_holiday, holiday_as')
    .eq('company_id', companyId)
  const hsList = (hsRows ?? []) as Array<{
    scope: 'company' | 'store'
    store_id: string | null
    scheduled_holidays: number[]
    legal_holiday: number
    holiday_as: string
  }>
  const hs =
    hsList.find((h) => h.scope === 'store' && h.store_id === storeId) ??
    hsList.find((h) => h.scope === 'company') ??
    null

  // --- japan_holidays（当日該当か）---
  const { data: jh } = await supabase
    .from('japan_holidays')
    .select('holiday_date')
    .eq('holiday_date', workDate)
    .maybeSingle()
  const isJapanHoliday = !!jh

  const dayType = resolveDayType(workDate, {
    scheduledHolidays: hs?.scheduled_holidays ?? [6],
    legalHoliday: hs?.legal_holiday ?? 0,
    holidayAs: (hs?.holiday_as as 'scheduled_holiday' | 'workday') ?? 'scheduled_holiday',
    isJapanHoliday,
  })

  return { scheduledMinutes, dayType }
}
