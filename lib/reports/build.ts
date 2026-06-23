/**
 * レポート行の生成・概算支給額の算出（純関数・テスト容易）
 *
 * - レポートは「全項目入りの1種類」のみ（勤怠一覧/給与計算用の区別なし）。
 * - 労働時間の区分は lib/workTime.ts が計算し work_time_calculations(8項目) に保存済み。
 *   ここでは **保存済みの8項目を再利用**するだけで、割増計算を二重実装しない。
 *
 * work_time_calculations(8項目) → レポート列の対応:
 *   labor_minutes          → 労働時間
 *   over_scheduled_minutes → 所定外
 *   (labor - over_scheduled) → 所定内（派生）
 *   over_legal_minutes     → 法定外残業
 *   midnight_minutes       → 深夜（深夜帯22-5時の総労働時間）
 *   holiday_minutes        → 法定休日
 *   scheduled_minutes / midnight_over_minutes / holiday_over_minutes は列に出さない（派生・補助用）
 *
 * 「深夜残業」列は work_time_calculations には保存されておらず、clock_in/clock_out/break から
 * calcMidnightOvertimeMinutes() で「深夜帯 ∩ 法定外残業」を算出する（= 深夜列の内数）。
 *   ※ DB の midnight_over_minutes（= 深夜割増"外"労働、仕様書5-2）とは別物・無関係。
 *
 * 概算支給額（CLAUDE.md 労働時間計算規約の割増率に準拠）:
 *   時給 = 所定内×時給 + 所定外×時給×1.25 + 深夜×時給×0.25 + 法定休日×時給×0.35
 *   日給 = 出勤日（labor>0）につき 日給1日ぶん
 *   月給 = 固定額のため per-row では算出不能 → null（Excel側で注記）
 */

import { calcMidnightOvertimeMinutes } from '@/lib/workTime'

export type WageType = 'hourly' | 'monthly' | 'daily'

export const WAGE_TYPE_LABEL: Record<WageType, string> = {
  hourly: '時給',
  daily: '日給',
  monthly: '月給',
}

/** DB から取得した work_time_calculations の8項目（null は 0 とみなす） */
export interface WtcMinutes {
  labor_minutes: number | null
  scheduled_minutes: number | null
  over_scheduled_minutes: number | null
  over_legal_minutes: number | null
  midnight_minutes: number | null
  midnight_over_minutes: number | null
  holiday_minutes: number | null
  holiday_over_minutes: number | null
}

export interface ReportRowInput {
  userId: string
  userName: string
  storeName: string
  workDate: string // YYYY-MM-DD
  clockIn: string | null // ISO8601 (UTC)
  clockOut: string | null
  breakMinutes: number // 深夜残業（深夜∩法定外残業）の算出に使用
  wtc: WtcMinutes | null
  wageType: WageType | null
  hourlyWage: number | null
  monthlyWage: number | null
  dailyWage: number | null
}

export interface ReportRow {
  userId: string
  userName: string
  storeName: string
  workDate: string
  clockIn: string | null
  clockOut: string | null
  laborMinutes: number
  scheduledInMinutes: number // 所定内
  overScheduledMinutes: number // 所定外
  overLegalMinutes: number // 法定外残業
  midnightMinutes: number // 深夜（深夜帯の総労働）
  midnightOvertimeMinutes: number // 深夜残業（深夜 ∩ 法定外残業、深夜列の内数）
  holidayMinutes: number // 法定休日
  wageType: WageType | null
  unitWage: number | null // 単価
  estimatedPay: number | null // 概算支給額
}

const n = (v: number | null | undefined) => Math.max(0, Math.round(v ?? 0))

/** 概算支給額（円・整数）。算出不能（月給など）は null */
export function estimatePay(args: {
  wageType: WageType | null
  hourlyWage: number | null
  dailyWage: number | null
  scheduledInMinutes: number
  overScheduledMinutes: number
  midnightMinutes: number
  holidayMinutes: number
  laborMinutes: number
}): number | null {
  const { wageType } = args
  if (wageType === 'hourly') {
    const w = args.hourlyWage
    if (w == null) return null
    const pay =
      (args.scheduledInMinutes / 60) * w +
      (args.overScheduledMinutes / 60) * w * 1.25 +
      (args.midnightMinutes / 60) * w * 0.25 +
      (args.holidayMinutes / 60) * w * 0.35
    return Math.round(pay)
  }
  if (wageType === 'daily') {
    const w = args.dailyWage
    if (w == null) return null
    // 出勤日（実労働あり）につき 日給1日ぶん
    return args.laborMinutes > 0 ? w : 0
  }
  // monthly: 固定額のため per-row では算出しない
  return null
}

/** 1 件の勤怠 + 計算結果 + 給与情報から ReportRow を生成 */
export function buildReportRow(input: ReportRowInput): ReportRow {
  const w = input.wtc
  const laborMinutes = n(w?.labor_minutes)
  const overScheduledMinutes = n(w?.over_scheduled_minutes)
  const scheduledInMinutes = Math.max(0, laborMinutes - overScheduledMinutes)
  const overLegalMinutes = n(w?.over_legal_minutes)
  const midnightMinutes = n(w?.midnight_minutes)
  const holidayMinutes = n(w?.holiday_minutes)

  // 深夜残業（深夜 ∩ 法定外残業）= 深夜列の内数。clock_in/out が揃う時のみ算出。
  const midnightOvertimeMinutes =
    input.clockIn && input.clockOut
      ? calcMidnightOvertimeMinutes(
          new Date(input.clockIn),
          new Date(input.clockOut),
          input.breakMinutes ?? 0,
        )
      : 0

  const unitWage =
    input.wageType === 'hourly'
      ? input.hourlyWage
      : input.wageType === 'daily'
        ? input.dailyWage
        : input.wageType === 'monthly'
          ? input.monthlyWage
          : null

  const estimatedPay = estimatePay({
    wageType: input.wageType,
    hourlyWage: input.hourlyWage,
    dailyWage: input.dailyWage,
    scheduledInMinutes,
    overScheduledMinutes,
    midnightMinutes,
    holidayMinutes,
    laborMinutes,
  })

  return {
    userId: input.userId,
    userName: input.userName,
    storeName: input.storeName,
    workDate: input.workDate,
    clockIn: input.clockIn,
    clockOut: input.clockOut,
    laborMinutes,
    scheduledInMinutes,
    overScheduledMinutes,
    overLegalMinutes,
    midnightMinutes,
    midnightOvertimeMinutes,
    holidayMinutes,
    wageType: input.wageType,
    unitWage,
    estimatedPay,
  }
}

/** ReportRow 群の合計（分項目 + 概算支給額）。null 支給は合計から除外 */
export interface ReportTotals {
  laborMinutes: number
  scheduledInMinutes: number
  overScheduledMinutes: number
  overLegalMinutes: number
  midnightMinutes: number
  midnightOvertimeMinutes: number
  holidayMinutes: number
  estimatedPay: number
}

export function sumReportRows(rows: ReportRow[]): ReportTotals {
  return rows.reduce<ReportTotals>(
    (acc, r) => ({
      laborMinutes: acc.laborMinutes + r.laborMinutes,
      scheduledInMinutes: acc.scheduledInMinutes + r.scheduledInMinutes,
      overScheduledMinutes: acc.overScheduledMinutes + r.overScheduledMinutes,
      overLegalMinutes: acc.overLegalMinutes + r.overLegalMinutes,
      midnightMinutes: acc.midnightMinutes + r.midnightMinutes,
      midnightOvertimeMinutes: acc.midnightOvertimeMinutes + r.midnightOvertimeMinutes,
      holidayMinutes: acc.holidayMinutes + r.holidayMinutes,
      estimatedPay: acc.estimatedPay + (r.estimatedPay ?? 0),
    }),
    {
      laborMinutes: 0,
      scheduledInMinutes: 0,
      overScheduledMinutes: 0,
      overLegalMinutes: 0,
      midnightMinutes: 0,
      midnightOvertimeMinutes: 0,
      holidayMinutes: 0,
      estimatedPay: 0,
    },
  )
}
