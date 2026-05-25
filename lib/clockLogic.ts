/**
 * 打刻ビジネスロジックの純関数群
 *
 * - 連続打刻防止: 直前イベントから 60 秒以内は拒否（in/out 同列）
 * - 同日打刻判定: stores.day_start_time を基準に当日分の attendance を解決
 * - 出退勤判定:
 *   - 同日 attendance 行なし or clock_in 未記録 → 出勤
 *   - clock_in 済み / clock_out 未記録 → 退勤
 *   - clock_in / clock_out 両方済み → エラー (CLOCK_ALREADY_CLOSED)
 */

import { resolveWorkDate } from './workTime'

/** 連続打刻ガードのウインドウ（秒） */
export const DUPLICATE_CLOCK_WINDOW_SECONDS = 60

/** 既存 attendance の最小スナップショット（DB から取得した今日分の行） */
export interface AttendanceSnapshot {
  id: string
  user_id: string
  work_date: string
  clock_in: string | null  // ISO 8601 or null
  clock_out: string | null
}

export type ClockEventDecision =
  | { kind: 'clock_in'; workDate: string }
  | { kind: 'clock_out'; attendanceId: string; workDate: string }
  | { kind: 'reject'; code: ClockRejectCode; lastClockAt?: string }

export type ClockRejectCode = 'CLOCK_TOO_FREQUENT' | 'CLOCK_ALREADY_CLOSED'

/**
 * 「これは出勤打刻か、退勤打刻か、それとも拒否すべきか」を判定する純関数。
 *
 * @param now           打刻時刻
 * @param dayStartTime  店舗の起算時刻 'HH:MM'
 * @param todayRecord   当日の attendance 行（NULL なら未打刻）
 * @param lastEventAt   直前イベント（in or out のうち新しい方）の時刻
 */
export function decideClockEvent(args: {
  now: Date
  dayStartTime: string
  todayRecord: AttendanceSnapshot | null
  lastEventAt: Date | null
}): ClockEventDecision {
  const { now, dayStartTime, todayRecord, lastEventAt } = args

  // 1) 連続打刻防止: 直前から DUPLICATE_CLOCK_WINDOW_SECONDS 以内は拒否
  if (lastEventAt) {
    const diffSec = (now.getTime() - lastEventAt.getTime()) / 1000
    if (diffSec >= 0 && diffSec < DUPLICATE_CLOCK_WINDOW_SECONDS) {
      return {
        kind: 'reject',
        code: 'CLOCK_TOO_FREQUENT',
        lastClockAt: lastEventAt.toISOString(),
      }
    }
  }

  const workDate = resolveWorkDate(now, dayStartTime)

  if (!todayRecord) {
    // 当日レコードなし → 初回打刻 = 出勤
    return { kind: 'clock_in', workDate }
  }

  if (todayRecord.clock_in && !todayRecord.clock_out) {
    // 出勤済み・退勤未 → 退勤
    return { kind: 'clock_out', attendanceId: todayRecord.id, workDate }
  }

  if (todayRecord.clock_in && todayRecord.clock_out) {
    // 出退勤両方済み → 3回目以降は Phase 10 まで非対応
    return { kind: 'reject', code: 'CLOCK_ALREADY_CLOSED' }
  }

  // clock_in が null だが record が存在する稀ケース → 出勤として扱う
  return { kind: 'clock_in', workDate }
}
