/**
 * 勤怠レポート CSV 直列化（純関数）
 *
 * 要件（CLAUDE.md / Phase4 仕様）:
 * - UTF-8 BOM 付き（Excel で開いて文字化けしない）
 * - 改行 CRLF
 * - 日時 JST
 * - 全項目（Excel テンプレートと同じ）をフラットに出力
 */

import { formatJstDateTime, minutesToHourMinute } from '@/lib/datetime'
import { WAGE_TYPE_LABEL, type ReportRow } from './build'

export const CSV_HEADERS = [
  '従業員名',
  '店舗',
  '勤務日',
  '出勤',
  '退勤',
  '労働時間',
  '所定内',
  '所定外',
  '法定外残業',
  '深夜',
  '深夜残業',
  '法定休日',
  '給与種別',
  '単価',
  '概算支給額',
] as const

const CRLF = '\r\n'
const BOM = '﻿'

/** CSV 1セルのエスケープ（カンマ/改行/ダブルクオート対応） */
export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** ReportRow → CSV の1行ぶんの文字列配列（15列） */
export function reportRowToCsvCells(r: ReportRow): string[] {
  return [
    r.userName,
    r.storeName,
    r.workDate, // 既に "YYYY-MM-DD"（work_date は JST 基準で確定済み）
    r.clockIn ? formatJstDateTime(r.clockIn) : '－',
    r.clockOut ? formatJstDateTime(r.clockOut) : '－',
    minutesToHourMinute(r.laborMinutes),
    minutesToHourMinute(r.scheduledInMinutes),
    minutesToHourMinute(r.overScheduledMinutes),
    minutesToHourMinute(r.overLegalMinutes),
    minutesToHourMinute(r.midnightMinutes),
    minutesToHourMinute(r.midnightOverMinutes),
    minutesToHourMinute(r.holidayMinutes),
    r.wageType ? WAGE_TYPE_LABEL[r.wageType] : '－',
    r.unitWage != null ? String(r.unitWage) : '',
    r.estimatedPay != null ? String(r.estimatedPay) : '',
  ]
}

/** ReportRow[] → CSV 文字列（BOM + CRLF 付き） */
export function buildCsv(rows: ReportRow[]): string {
  const lines: string[] = []
  lines.push(CSV_HEADERS.map(csvEscape).join(','))
  for (const r of rows) {
    lines.push(reportRowToCsvCells(r).map(csvEscape).join(','))
  }
  return BOM + lines.join(CRLF) + CRLF
}
