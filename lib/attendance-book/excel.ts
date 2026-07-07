/**
 * 出勤簿 Excel 生成（exceljs・サーバ専用）
 *
 * - 1シート = 1従業員 × 1ヶ月。複数月/複数従業員は AttendanceBookSheet[] を順にシート化。
 * - シート名 = 氏名 + 年月（31字制限・重複回避）。並び順は query 側（groupBy）で確定済み。
 * - レイアウトは lib/attendance-book/layout.ts の AttendanceBookSheet を消費（印刷プレビューと共通）。
 * - 書式は lib/reports/excel.ts を踏襲（ヘッダー #0ABAB5 白字 / 交互背景 / 合計 / 土日赤字 / Meiryo / 罫線）。
 * - 時間列は「時刻シリアル(分/1440)」+ 表示形式 [h]:mm で保持し、合計は実 SUM 数式。打刻なしは「－」。
 * - 概算支給額・単価・給与種別は載せない（出勤簿は勤怠記録に徹する）。
 */

import ExcelJS from 'exceljs'
import { formatJstTime } from '@/lib/datetime'
import { periodLabel } from '@/lib/reports/period'
import type { AttendanceBookSheet } from './layout'

// 色（ARGB, 先頭 FF = 不透明）— reports/excel.ts と統一
const C = {
  tiffany: 'FF0ABAB5',
  titleText: 'FF089690',
  sub: 'FF666666',
  white: 'FFFFFFFF',
  evenRow: 'FFF5FAFA',
  totalRow: 'FFE6F7F6',
  weekend: 'FFC0392B',
  ink: 'FF1F2937',
  border: 'FFD0D7DE',
} as const

const FONT = 'Meiryo'
const HEADERS = [
  '日付',
  '曜日',
  '出勤',
  '退勤',
  '休憩',
  '労働',
  '所定内',
  '所定外',
  '深夜',
  '深夜残業',
  '法定休日',
]
const DATA_COLS = 11 // A..K
const SUM_FIRST_COL = 6 // F列（労働）〜 K列（法定休日）が合計対象の時間列

const thinBorder = (): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  left: { style: 'thin', color: { argb: C.border } },
  right: { style: 'thin', color: { argb: C.border } },
})

/** 分 → Excel 時刻シリアル（1.0 = 24h） */
function minToSerial(min: number): number {
  return min / 1440
}

/** Excel シート名として安全な名前に整形（禁止文字除去・31字・重複回避） */
function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, '_').trim().slice(0, 31)
  if (base.length === 0) base = 'sheet'
  let candidate = base
  let i = 2
  while (used.has(candidate)) {
    const suffix = `_${i}`
    candidate = base.slice(0, 31 - suffix.length) + suffix
    i += 1
  }
  used.add(candidate)
  return candidate
}

function buildSheet(ws: ExcelJS.Worksheet, sheet: AttendanceBookSheet) {
  const { header, days, totals } = sheet
  ws.views = [{ showGridLines: false }]
  ws.columns = [
    { width: 7 }, // 日付
    { width: 5 }, // 曜日
    { width: 8 }, // 出勤
    { width: 8 }, // 退勤
    { width: 8 }, // 休憩
    { width: 9 }, // 労働
    { width: 9 }, // 所定内
    { width: 9 }, // 所定外
    { width: 9 }, // 深夜
    { width: 10 }, // 深夜残業
    { width: 9 }, // 法定休日
  ]

  // 行1: タイトル（会社名 + 出勤簿）
  ws.mergeCells(1, 1, 1, DATA_COLS)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `${header.companyName}　出勤簿`
  titleCell.font = { name: FONT, bold: true, size: 14, color: { argb: C.titleText } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 24

  // 行2: 事業所 / 従業員（社員番号） / 職種
  ws.mergeCells(2, 1, 2, DATA_COLS)
  const empNo = header.employeeNo ? `（社員番号 ${header.employeeNo}）` : ''
  const job = header.jobTitle ? `　/　職種: ${header.jobTitle}` : ''
  const sub = ws.getCell(2, 1)
  sub.value = `事業所: ${header.storeName}　/　従業員: ${header.employeeName}${empNo}${job}`
  sub.font = { name: FONT, size: 10, color: { argb: C.sub } }
  sub.alignment = { horizontal: 'center' }

  // 行3: 対象年月
  ws.mergeCells(3, 1, 3, DATA_COLS)
  const period = ws.getCell(3, 1)
  period.value = `対象年月: ${periodLabel(header.year, header.month)}`
  period.font = { name: FONT, size: 10, color: { argb: C.sub } }
  period.alignment = { horizontal: 'center' }

  // 行4: 列ヘッダー
  const headerRowIdx = 4
  const headerRow = ws.getRow(headerRowIdx)
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: FONT, bold: true, color: { argb: C.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.tiffany } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })
  headerRow.height = 20

  // データ行（当月全日）
  const firstDataRow = headerRowIdx + 1
  days.forEach((day, idx) => {
    const rowIdx = firstDataRow + idx
    const row = ws.getRow(rowIdx)
    const striped = idx % 2 === 1

    // A: 日付, B: 曜日（土日赤字）
    const dateColor = day.isWeekend ? C.weekend : C.ink
    row.getCell(1).value = day.dateLabel
    row.getCell(1).font = { name: FONT, color: { argb: dateColor } }
    row.getCell(2).value = day.weekday
    row.getCell(2).font = { name: FONT, color: { argb: dateColor } }

    if (day.hasRecord) {
      row.getCell(3).value = day.clockIn ? formatJstTime(day.clockIn) : '－'
      row.getCell(4).value = day.clockOut ? formatJstTime(day.clockOut) : '－'
      // 休憩(5) + 労働〜法定休日(6..11) を時刻シリアルで
      const durations: (number | null)[] = [
        day.breakMinutes,
        day.laborMinutes,
        day.scheduledInMinutes,
        day.overScheduledMinutes,
        day.midnightMinutes,
        day.midnightOvertimeMinutes,
        day.holidayMinutes,
      ]
      durations.forEach((min, i) => {
        const cell = row.getCell(5 + i)
        if (min == null) {
          cell.value = '－'
        } else {
          cell.value = minToSerial(min)
          cell.numFmt = '[h]:mm'
        }
      })
    } else {
      for (let c = 3; c <= DATA_COLS; c += 1) row.getCell(c).value = '－'
    }

    // 共通スタイル（罫線・フォント・交互背景・中央寄せ）
    for (let c = 1; c <= DATA_COLS; c += 1) {
      const cell = row.getCell(c)
      cell.font = cell.font ? { ...cell.font, name: FONT } : { name: FONT }
      cell.border = thinBorder()
      cell.alignment = { horizontal: 'center' }
      if (striped) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.evenRow } }
      }
    }
  })

  const lastDataRow = firstDataRow + days.length - 1
  const totalRowIdx = lastDataRow + 1

  // 合計行: A:C = 「合計（出勤 N 日）」、F〜K = SUM
  const totalRow = ws.getRow(totalRowIdx)
  ws.mergeCells(totalRowIdx, 1, totalRowIdx, SUM_FIRST_COL - 1)
  totalRow.getCell(1).value = `合計（出勤 ${totals.workdayCount} 日）`
  totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }

  const totalSerials = [
    totals.laborMinutes,
    totals.scheduledInMinutes,
    totals.overScheduledMinutes,
    totals.midnightMinutes,
    totals.midnightOvertimeMinutes,
    totals.holidayMinutes,
  ]
  totalSerials.forEach((min, i) => {
    const colIdx = SUM_FIRST_COL + i
    const colLetter = ws.getColumn(colIdx).letter
    const cell = totalRow.getCell(colIdx)
    cell.value = {
      formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`,
      result: minToSerial(min),
    }
    cell.numFmt = '[h]:mm'
  })
  for (let c = 1; c <= DATA_COLS; c += 1) {
    const cell = totalRow.getCell(c)
    cell.font = { name: FONT, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalRow } }
    cell.border = thinBorder()
    if (c >= SUM_FIRST_COL) cell.alignment = { horizontal: 'center' }
  }

  // 注記
  const noteRowIdx = totalRowIdx + 2
  ws.mergeCells(noteRowIdx, 1, noteRowIdx, DATA_COLS)
  const note = ws.getCell(noteRowIdx, 1)
  note.value =
    '※「深夜」列＝深夜帯(22:00-05:00)の総労働、「深夜残業」列＝そのうち法定外残業に重なる分（深夜の内数）。' +
    '打刻の無い日・休みの日は「－」で表示しています。'
  note.font = { name: FONT, italic: true, size: 9, color: { argb: C.sub } }
  note.alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(noteRowIdx).height = 28
}

/**
 * AttendanceBookSheet[] から xlsx バイナリ（Buffer 互換）を生成。
 * 0件時は案内シート1枚を返す。
 */
export async function buildAttendanceBookWorkbook(
  sheets: AttendanceBookSheet[],
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'YUG Attendance'

  if (sheets.length === 0) {
    const ws = wb.addWorksheet('該当なし')
    ws.views = [{ showGridLines: false }]
    ws.mergeCells(1, 1, 1, DATA_COLS)
    const cell = ws.getCell(1, 1)
    cell.value = '該当する従業員・期間の勤怠データがありません。'
    cell.font = { name: FONT, size: 12, color: { argb: C.sub } }
    return wb.xlsx.writeBuffer()
  }

  const used = new Set<string>()
  for (const sheet of sheets) {
    const { header } = sheet
    const base = `${header.employeeName}_${header.year}-${String(header.month).padStart(2, '0')}`
    const ws = wb.addWorksheet(safeSheetName(base, used))
    buildSheet(ws, sheet)
  }

  return wb.xlsx.writeBuffer()
}
