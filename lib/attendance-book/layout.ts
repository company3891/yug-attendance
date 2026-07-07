/**
 * 出勤簿レイアウト定義（純関数・Excel と 印刷プレビューの共通ソース）
 *
 * 「1シート = 1従業員 × 1ヶ月」の台帳を表す正規化データ AttendanceBookSheet を生成する。
 * Excel 出力（lib/attendance-book/excel.ts）と 印刷プレビュー画面が **同じ構造** を消費し、
 * レイアウトの二重管理を避ける。
 *
 * 労働時間の区分は lib/reports/build.ts（= lib/workTime.ts の計算結果 8項目）を再利用する。
 * ここでは割増計算を一切しない。集計は既存 sumReportRows を流用し、出勤日数のみ追加でカウントする。
 *
 * 列（確定・11列）:
 *   日付 / 曜日 / 出勤 / 退勤 / 休憩 / 労働 / 所定内 / 所定外 / 深夜 / 深夜残業 / 法定休日
 *   ※概算支給額・単価・給与種別は出勤簿には載せない（勤怠記録に徹する）。
 */

import { formatMonthDay, isWeekend, weekdayLabel } from '@/lib/datetime'
import { sumReportRows, type ReportRow } from '@/lib/reports/build'
import { eachDayOfMonth } from '@/lib/reports/period'

export interface AttendanceBookHeader {
  companyName: string
  storeName: string
  employeeName: string
  employeeNo: string | null
  jobTitle: string | null
  year: number
  month: number
}

/** 1日分の明細（打刻なし・休みの日は hasRecord=false / 各値 null → 表示側で「－」） */
export interface AttendanceBookDay {
  workDate: string // YYYY-MM-DD
  dateLabel: string // M/D
  weekday: string // 月
  isWeekend: boolean
  hasRecord: boolean
  clockIn: string | null // ISO8601(UTC) / null
  clockOut: string | null
  breakMinutes: number | null
  laborMinutes: number | null
  scheduledInMinutes: number | null
  overScheduledMinutes: number | null
  midnightMinutes: number | null
  midnightOvertimeMinutes: number | null
  holidayMinutes: number | null
}

export interface AttendanceBookTotals {
  workdayCount: number // 出勤日数（clock_in のある日数）
  laborMinutes: number
  scheduledInMinutes: number
  overScheduledMinutes: number
  midnightMinutes: number
  midnightOvertimeMinutes: number
  holidayMinutes: number
}

export interface AttendanceBookSheet {
  header: AttendanceBookHeader
  days: AttendanceBookDay[]
  totals: AttendanceBookTotals
}

/** ReportRow（区分計算済み）に休憩分を添えた、その月の実打刻日ぶんの入力行 */
export interface BookDailySource extends ReportRow {
  breakMinutes: number
}

/**
 * 1従業員1ヶ月ぶんのシートを組み立てる。
 * @param header 会社/事業所/従業員/対象年月
 * @param rows   その従業員・その月の **実打刻がある日** の行（全日ぶんでなくてよい）
 */
export function buildAttendanceBookSheet(
  header: AttendanceBookHeader,
  rows: BookDailySource[],
): AttendanceBookSheet {
  const byDate = new Map(rows.map((r) => [r.workDate, r]))

  const days: AttendanceBookDay[] = eachDayOfMonth(header.year, header.month).map((workDate) => {
    const rec = byDate.get(workDate)
    return {
      workDate,
      dateLabel: formatMonthDay(workDate),
      weekday: weekdayLabel(workDate),
      isWeekend: isWeekend(workDate),
      hasRecord: rec != null,
      clockIn: rec?.clockIn ?? null,
      clockOut: rec?.clockOut ?? null,
      breakMinutes: rec ? rec.breakMinutes : null,
      laborMinutes: rec ? rec.laborMinutes : null,
      scheduledInMinutes: rec ? rec.scheduledInMinutes : null,
      overScheduledMinutes: rec ? rec.overScheduledMinutes : null,
      midnightMinutes: rec ? rec.midnightMinutes : null,
      midnightOvertimeMinutes: rec ? rec.midnightOvertimeMinutes : null,
      holidayMinutes: rec ? rec.holidayMinutes : null,
    }
  })

  // 区分の合計は既存 sumReportRows を流用（BookDailySource は ReportRow を継承）
  const sums = sumReportRows(rows)
  const workdayCount = rows.filter((r) => r.clockIn != null).length

  return {
    header,
    days,
    totals: {
      workdayCount,
      laborMinutes: sums.laborMinutes,
      scheduledInMinutes: sums.scheduledInMinutes,
      overScheduledMinutes: sums.overScheduledMinutes,
      midnightMinutes: sums.midnightMinutes,
      midnightOvertimeMinutes: sums.midnightOvertimeMinutes,
      holidayMinutes: sums.holidayMinutes,
    },
  }
}
