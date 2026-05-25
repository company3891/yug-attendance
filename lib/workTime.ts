/**
 * 労働時間計算ユーティリティ（純関数）
 *
 * 仕様書「5-2. 労働時間自動計算」の 8 項目をすべて計算する。
 * Date オブジェクト入出力のみ。DB 依存なし。テスト容易。
 *
 * 設計原則:
 * - 日付またぎ・深夜・休日種別すべてここで吸収する
 * - 異常データ（clockOut<clockIn 等）は throw or hasAnomaly フラグで返す
 * - 割増率の掛け算は給与計算（Phase 4 以降）で実施、ここでは「該当分数」のみ返す
 */

const MINUTE = 60 * 1000

// 深夜帯のデフォルト境界（22:00〜翌05:00）
const DEFAULT_MIDNIGHT_START_HOUR = 22
const DEFAULT_MIDNIGHT_END_HOUR = 5

// 法定労働時間（1日）= 8時間 = 480分
const LEGAL_DAILY_MINUTES = 480

// 異常判定: 連続勤務の上限（仮眠込みで実労働 24h 超は人間生理的にもまずい）
const MAX_LABOR_MINUTES_BEFORE_ANOMALY = 24 * 60

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type DayType =
  | 'workday'             // 出勤日（平日）
  | 'legal_holiday'       // 法定休日（35%割増対象）
  | 'scheduled_holiday'   // 所定休日（25%割増、所定外労働に集約）
  | 'national_holiday'    // 祝日（運用は scheduled_holiday と同等）
  | 'company_holiday'     // 会社独自休日（同上）

export interface WorkTimeInput {
  clockIn: Date
  clockOut: Date
  breakMinutes: number
  scheduledMinutes: number  // 店舗の1日所定時間（例: 480）
  dayType: DayType
  midnightStartHour?: number
  midnightEndHour?: number
}

export interface WorkTimeBreakdown {
  laborMinutes: number             // 実労働 = 退勤-出勤-休憩（0でクランプ）
  scheduledMinutes: number         // 所定時間（店舗設定）
  overScheduledMinutes: number     // 所定外労働（max(0, labor-scheduled), ただし所定休日労働も加算）
  overLegalMinutes: number         // 法定外労働（max(0, labor-480)）
  midnightMinutes: number          // 深夜割増対象時間（22:00-05:00 該当分）
  midnightOverMinutes: number      // 深夜以外の労働時間（labor - midnight）
  holidayMinutes: number           // 法定休日の労働時間（35%割増対象）
  holidayOverMinutes: number       // 平日労働時間（labor - holiday）
  hasAnomaly: boolean
  anomalyCodes: AnomalyCode[]
}

/**
 * 打刻異常コード（attendances.anomaly_codes text[] に格納）。
 * CLAUDE.md「打刻異常コード一覧」と同期を保つこと。
 */
export type AnomalyCode =
  | 'clock_out_before_in'    // 退勤時刻 < 出勤時刻
  | 'break_exceeds_work'     // 休憩時間 > 実労働時間
  | 'duration_over_24h'      // 連続勤務 24 時間超
  | 'duplicate_clock'        // 連続打刻（API層で検出）

// ---------------------------------------------------------------------------
// 基本: 労働時間（分）
// ---------------------------------------------------------------------------

export function calcLaborMinutes(clockIn: Date, clockOut: Date, breakMinutes: number): number {
  if (clockOut.getTime() < clockIn.getTime()) {
    throw new Error('clockOut must be >= clockIn')
  }
  const elapsed = Math.floor((clockOut.getTime() - clockIn.getTime()) / MINUTE)
  return Math.max(0, elapsed - breakMinutes)
}

// ---------------------------------------------------------------------------
// 深夜帯（22:00-翌5:00）に該当する分数
// ---------------------------------------------------------------------------

/**
 * 任意の連続区間 [start, end] のうち、深夜帯（midnightStartHour 〜 翌 midnightEndHour）
 * に該当する分数を返す。日付またぎに対応。
 */
export function calcMidnightMinutes(
  start: Date,
  end: Date,
  midnightStartHour: number = DEFAULT_MIDNIGHT_START_HOUR,
  midnightEndHour: number = DEFAULT_MIDNIGHT_END_HOUR,
): number {
  if (end.getTime() <= start.getTime()) return 0

  let total = 0
  const stepMs = MINUTE // 1分ごとに評価（最大1440回 = 1日24時間ぶん。性能十分）

  for (let t = start.getTime(); t < end.getTime(); t += stepMs) {
    const hour = new Date(t).getHours()
    // 深夜帯判定: hour >= midnightStartHour || hour < midnightEndHour
    if (hour >= midnightStartHour || hour < midnightEndHour) {
      total += 1
    }
  }
  return total
}

// ---------------------------------------------------------------------------
// 統合: 8 項目すべて計算
// ---------------------------------------------------------------------------

export function calcWorkTimeBreakdown(input: WorkTimeInput): WorkTimeBreakdown {
  const {
    clockIn,
    clockOut,
    breakMinutes,
    scheduledMinutes,
    dayType,
    midnightStartHour = DEFAULT_MIDNIGHT_START_HOUR,
    midnightEndHour = DEFAULT_MIDNIGHT_END_HOUR,
  } = input

  // 1) 実労働時間（休憩クランプ含む）
  const rawElapsed = Math.floor((clockOut.getTime() - clockIn.getTime()) / MINUTE)
  if (clockOut.getTime() < clockIn.getTime()) {
    throw new Error('clockOut must be >= clockIn')
  }

  const anomalies: AnomalyCode[] = []
  let laborMinutes = rawElapsed - breakMinutes
  if (laborMinutes < 0) {
    anomalies.push('break_exceeds_work')
    laborMinutes = 0
  }

  // 2) 24時間超チェック
  if (rawElapsed > MAX_LABOR_MINUTES_BEFORE_ANOMALY) {
    anomalies.push('duration_over_24h')
  }

  // 3) 法定外労働（>8h）
  const overLegalMinutes = Math.max(0, laborMinutes - LEGAL_DAILY_MINUTES)

  // 4) 所定外労働（>scheduled）
  //    + 所定休日は労働時間そのものを所定外に集約
  let overScheduledMinutes = Math.max(0, laborMinutes - scheduledMinutes)
  const isScheduledHolidayLike =
    dayType === 'scheduled_holiday' ||
    dayType === 'national_holiday' ||
    dayType === 'company_holiday'
  if (isScheduledHolidayLike) {
    overScheduledMinutes = laborMinutes
  }

  // 5) 深夜（22:00-05:00 に該当する分数）
  //    休憩は「まず非深夜時間から差し引く」モデル: midnight は raw のまま、
  //    残りを midnightOver にする。これにより
  //    - 深夜帯前に休憩が入る飲食店典型パターンが自然に表現される
  //    - 「深夜何分働いたか」が明確になる（割増賃金計算の根拠）
  let midnightMinutes = calcMidnightMinutes(clockIn, clockOut, midnightStartHour, midnightEndHour)
  if (laborMinutes === 0) midnightMinutes = 0
  // labor を超えないよう上限クランプ
  midnightMinutes = Math.min(midnightMinutes, laborMinutes)
  const midnightOverMinutes = Math.max(0, laborMinutes - midnightMinutes)

  // 6) 休日労働（法定休日のみ holiday、それ以外は overScheduled に集約）
  const isLegalHoliday = dayType === 'legal_holiday'
  const holidayMinutes = isLegalHoliday ? laborMinutes : 0
  const holidayOverMinutes = isLegalHoliday ? 0 : laborMinutes

  return {
    laborMinutes,
    scheduledMinutes,
    overScheduledMinutes,
    overLegalMinutes,
    midnightMinutes,
    midnightOverMinutes,
    holidayMinutes,
    holidayOverMinutes,
    hasAnomaly: anomalies.length > 0,
    anomalyCodes: anomalies,
  }
}

// ---------------------------------------------------------------------------
// work_date 解決（day_start_time を考慮した「勤務日」の決定）
// ---------------------------------------------------------------------------

/**
 * 打刻時刻と店舗の起算時刻から「勤務日」を解決する。
 *
 * 例: day_start_time='05:00' の店舗で 翌02:00 打刻 → 前日の勤務扱い
 *
 * @param clockAt 打刻時刻
 * @param dayStartTime 'HH:MM' 形式の起算時刻（既定 '00:00'）
 * @returns 'YYYY-MM-DD' (JST想定)
 */
export function resolveWorkDate(clockAt: Date, dayStartTime: string = '00:00'): string {
  const [hStr, mStr] = dayStartTime.split(':')
  const startHour = Number(hStr)
  const startMin = Number(mStr ?? 0)

  // 打刻時刻が起算時刻より前なら「前日」扱い
  const adjusted = new Date(clockAt.getTime())
  if (
    adjusted.getHours() < startHour ||
    (adjusted.getHours() === startHour && adjusted.getMinutes() < startMin)
  ) {
    adjusted.setDate(adjusted.getDate() - 1)
  }

  const y = adjusted.getFullYear()
  const m = String(adjusted.getMonth() + 1).padStart(2, '0')
  const d = String(adjusted.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
