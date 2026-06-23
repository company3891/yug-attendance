/**
 * 勤怠レポート Excel 生成（exceljs・サーバ専用）
 *
 * 「給与計算用_見本_2026-06.xlsx」確定仕様に準拠:
 * - 1ファイル=1期間、従業員ごとにシート分け（シート名=氏名、31文字制限・重複回避）
 * - 各シート: タイトル / 対象期間 / 給与種別 / 9列ヘッダー / 日次データ(全日) / 合計(SUM) / 概算支給額 / 注記
 * - デザイン: ヘッダー #0ABAB5(白字)、交互背景 #F5FAFA、合計 #E6F7F6、概算 #FFF6E6、土日赤字、Meiryo、罫線、gridline非表示
 * - 割増区分・概算支給額は lib/reports/build.ts（= lib/workTime.ts の計算結果）を使用。見本の簡易計算は使わない。
 *
 * Excel の数値セルは「時刻シリアル(分/1440)」+ 表示形式 [h]:mm で保持し、合計は実際の SUM 数式で算出
 * （ハードコードなし／#REF! 等の数式エラーゼロ）。勤務なしの日は「－」テキスト（SUM は無視）。
 */

import ExcelJS from 'exceljs'
import { formatJstTime, formatWorkDateLabel, isWeekend } from '@/lib/datetime'
import {
  sumReportRows,
  WAGE_TYPE_LABEL,
  type ReportRow,
  type WageType,
} from './build'
import { periodLabel } from './period'

export interface WorkbookMeta {
  year: number
  month: number
  clientName: string
}

// 色（ARGB, 先頭 FF = 不透明）
const C = {
  tiffany: 'FF0ABAB5',
  titleText: 'FF089690',
  sub: 'FF666666',
  white: 'FFFFFFFF',
  evenRow: 'FFF5FAFA',
  totalRow: 'FFE6F7F6',
  payRow: 'FFFFF6E6',
  weekend: 'FFC0392B',
  border: 'FFD0D7DE',
} as const

const FONT = 'Meiryo'
const HEADERS = ['日付', '出勤', '退勤', '労働', '所定内', '所定外', '深夜', '深夜残業', '法定休日']
const DATA_COLS = 9 // A..I
const DUR_FIRST_COL = 4 // D列（労働）から I列（法定休日）までが時間項目

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

const UNIT_SUFFIX: Record<WageType, string> = { hourly: '時', daily: '日', monthly: '月' }

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

/** userId 単位でグループ化（出現順を保持） */
function groupByUser(rows: ReportRow[]): Map<string, ReportRow[]> {
  const map = new Map<string, ReportRow[]>()
  for (const r of rows) {
    const list = map.get(r.userId)
    if (list) list.push(r)
    else map.set(r.userId, [r])
  }
  return map
}

function buildSheet(ws: ExcelJS.Worksheet, empRows: ReportRow[], meta: WorkbookMeta) {
  ws.views = [{ showGridLines: false }]
  ws.columns = [
    { width: 12 },
    { width: 8 },
    { width: 8 },
    { width: 9 },
    { width: 9 },
    { width: 9 },
    { width: 9 },
    { width: 10 },
    { width: 9 },
  ]

  const first = empRows[0]
  const name = first?.userName ?? ''
  const stores = Array.from(new Set(empRows.map((r) => r.storeName))).join(' / ') || '－'
  const wageType = first?.wageType ?? null
  const unitWage = first?.unitWage ?? null

  // 行1: タイトル
  ws.mergeCells(1, 1, 1, DATA_COLS)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `${meta.clientName ? `${meta.clientName}　` : ''}給与計算用 勤怠明細`
  titleCell.font = { name: FONT, bold: true, size: 14, color: { argb: C.titleText } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 24

  // 行2: 対象期間 / 店舗 / 氏名
  ws.mergeCells(2, 1, 2, DATA_COLS)
  const subCell = ws.getCell(2, 1)
  subCell.value = `対象期間: ${periodLabel(meta.year, meta.month)}　/　${stores}　/　${name}`
  subCell.font = { name: FONT, size: 10, color: { argb: C.sub } }
  subCell.alignment = { horizontal: 'center' }

  // 行3: 給与種別
  ws.mergeCells(3, 1, 3, DATA_COLS)
  const wageCell = ws.getCell(3, 1)
  wageCell.value =
    wageType && unitWage != null
      ? `給与種別: ${WAGE_TYPE_LABEL[wageType]}（${unitWage.toLocaleString('ja-JP')}円/${UNIT_SUFFIX[wageType]}）`
      : '給与種別: 未設定'
  wageCell.font = { name: FONT, size: 10, color: { argb: C.sub } }

  // 行4: ヘッダー
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
  const byDate = new Map(empRows.map((r) => [r.workDate, r]))
  const lastDay = new Date(meta.year, meta.month, 0).getDate()
  const firstDataRow = headerRowIdx + 1
  let rowIdx = firstDataRow

  for (let d = 1; d <= lastDay; d += 1) {
    const workDate = `${meta.year}-${String(meta.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const row = ws.getRow(rowIdx)
    const rec = byDate.get(workDate)
    const weekend = isWeekend(workDate)
    const striped = (rowIdx - firstDataRow) % 2 === 1

    // A: 日付（土日赤字）
    const dateCell = row.getCell(1)
    dateCell.value = formatWorkDateLabel(workDate)
    dateCell.font = { name: FONT, color: { argb: weekend ? C.weekend : 'FF1F2937' } }
    dateCell.alignment = { horizontal: 'center' }

    if (rec) {
      row.getCell(2).value = rec.clockIn ? formatJstTime(rec.clockIn) : '－'
      row.getCell(3).value = rec.clockOut ? formatJstTime(rec.clockOut) : '－'
      const durs = [
        rec.laborMinutes,
        rec.scheduledInMinutes,
        rec.overScheduledMinutes,
        rec.midnightMinutes,
        rec.midnightOvertimeMinutes,
        rec.holidayMinutes,
      ]
      durs.forEach((min, i) => {
        const cell = row.getCell(DUR_FIRST_COL + i)
        cell.value = minToSerial(min)
        cell.numFmt = '[h]:mm'
      })
    } else {
      for (let c = 2; c <= DATA_COLS; c += 1) row.getCell(c).value = '－'
    }

    // 共通スタイル（罫線・フォント・交互背景・中央寄せ）
    for (let c = 1; c <= DATA_COLS; c += 1) {
      const cell = row.getCell(c)
      if (!cell.font) cell.font = { name: FONT }
      else cell.font = { ...cell.font, name: FONT }
      cell.border = thinBorder()
      if (c >= 2) cell.alignment = { horizontal: 'center' }
      if (striped) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.evenRow } }
      }
    }
    rowIdx += 1
  }

  const lastDataRow = rowIdx - 1
  const totals = sumReportRows(empRows)

  // 合計行
  const totalRow = ws.getRow(rowIdx)
  totalRow.getCell(1).value = '合計'
  const totalSerials = [
    totals.laborMinutes,
    totals.scheduledInMinutes,
    totals.overScheduledMinutes,
    totals.midnightMinutes,
    totals.midnightOvertimeMinutes,
    totals.holidayMinutes,
  ]
  totalSerials.forEach((min, i) => {
    const colLetter = ws.getColumn(DUR_FIRST_COL + i).letter
    const cell = totalRow.getCell(DUR_FIRST_COL + i)
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
    if (c >= 2) cell.alignment = { horizontal: 'center' }
  }
  rowIdx += 1

  // 概算支給額行（A:H 結合ラベル + I 金額）
  const payRowIdx = rowIdx
  ws.mergeCells(payRowIdx, 1, payRowIdx, DATA_COLS - 1)
  const payLabel = ws.getCell(payRowIdx, 1)
  const isMonthly = wageType === 'monthly'
  const payAmount = isMonthly ? (unitWage ?? 0) : totals.estimatedPay
  payLabel.value = isMonthly
    ? '概算支給額（月給固定額・割増は別途精算）'
    : '概算支給額（所定内 + 所定外×1.25 + 深夜×0.25 + 法定休日×0.35）'
  payLabel.font = { name: FONT, bold: true }
  payLabel.alignment = { horizontal: 'right', vertical: 'middle' }
  const payValue = ws.getCell(payRowIdx, DATA_COLS)
  payValue.value = payAmount
  payValue.numFmt = '"¥"#,##0'
  payValue.font = { name: FONT, bold: true }
  payValue.alignment = { horizontal: 'right' }
  for (let c = 1; c <= DATA_COLS; c += 1) {
    const cell = ws.getCell(payRowIdx, c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.payRow } }
    cell.border = thinBorder()
  }
  rowIdx += 2 // 1行あける

  // 注記
  ws.mergeCells(rowIdx, 1, rowIdx, DATA_COLS)
  const note = ws.getCell(rowIdx, 1)
  note.value =
    '※本表は勤怠データに基づく概算です。実際の支給額は控除・各種手当を加味して確定します。' +
    '「深夜」列＝深夜帯(22:00-05:00)の総労働、「深夜残業」列＝そのうち法定外残業に重なる分（深夜の内数）。'
  note.font = { name: FONT, italic: true, size: 9, color: { argb: C.sub } }
  note.alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(rowIdx).height = 30
}

/**
 * ReportRow[] からワークブックを生成し、xlsx バイナリ（Buffer 互換）を返す。
 * 従業員が0件の場合は空シート（案内文）を1枚入れる。
 */
export async function buildReportWorkbook(
  rows: ReportRow[],
  meta: WorkbookMeta,
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'YUG Attendance'

  const grouped = groupByUser(rows)
  const used = new Set<string>()

  if (grouped.size === 0) {
    const ws = wb.addWorksheet('該当なし')
    ws.views = [{ showGridLines: false }]
    ws.mergeCells(1, 1, 1, DATA_COLS)
    const cell = ws.getCell(1, 1)
    cell.value = `${periodLabel(meta.year, meta.month)} に該当する勤怠データがありません。`
    cell.font = { name: FONT, size: 12, color: { argb: C.sub } }
  } else {
    for (const empRows of grouped.values()) {
      const sheetName = safeSheetName(empRows[0]?.userName ?? 'sheet', used)
      const ws = wb.addWorksheet(sheetName)
      buildSheet(ws, empRows, meta)
    }
  }

  return wb.xlsx.writeBuffer()
}
