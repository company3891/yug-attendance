/**
 * 日種別判定（純関数・Phase 5）
 *
 * 勤務日 + 解決済みの休日設定から日種別を判定する。DBアクセスは行わず、
 * 呼び出し側が holiday_settings（store→company フォールバック解決済み）と
 * 「その日が日本の祝日か」を引数で渡す（Phase 4 の純関数方針を踏襲）。
 *
 * 判定順（CLAUDE.md / Phase5 設計指示書）:
 *   1. 曜日を求める
 *   2. 法定休日の曜日と一致 → 'legal_holiday'（※所定休日と重なっても法定優先）
 *   3. 所定休日の曜日に含まれる → 'scheduled_holiday'
 *   4. 日本の祝日 かつ holiday_as='scheduled_holiday' → 'scheduled_holiday'
 *   5. それ以外 → 'workday'
 */

import type { DayType } from '@/lib/workTime'

export interface DayTypeSettings {
  /** 所定休日の曜日（0=日..6=土） */
  scheduledHolidays: number[]
  /** 法定休日の曜日（0=日..6=土） */
  legalHoliday: number
  /** 祝日の扱い */
  holidayAs: 'scheduled_holiday' | 'workday'
  /** その勤務日が japan_holidays に該当するか（呼び出し側が判定して渡す） */
  isJapanHoliday: boolean
}

/**
 * 'YYYY-MM-DD' の曜日（0=日..6=土）。date-only なので UTC 固定で TZ 非依存に求める。
 */
export function weekdayOf(workDate: string): number {
  const m = workDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) throw new Error(`invalid work_date: ${workDate}`)
  const [, y, mo, d] = m
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()
}

export function resolveDayType(workDate: string, settings: DayTypeSettings): DayType {
  const wd = weekdayOf(workDate)

  // 2. 法定休日（最優先。所定休日と重なっても割増の高い法定を確保）
  if (wd === settings.legalHoliday) return 'legal_holiday'

  // 3. 所定休日の曜日
  if (settings.scheduledHolidays.includes(wd)) return 'scheduled_holiday'

  // 4. 祝日（扱いが所定休日のとき）
  if (settings.isJapanHoliday && settings.holidayAs === 'scheduled_holiday') {
    return 'scheduled_holiday'
  }

  // 5. 平日
  return 'workday'
}
