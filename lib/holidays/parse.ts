/**
 * 内閣府「国民の祝日」CSV のパース（純ロジック・ネット非依存・テスト容易）
 *
 * 取得元: https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv （Shift_JIS）
 * CSV 形式（Shift_JIS）:
 *   国民の祝日・休日月日,国民の祝日・休日名称
 *   2027/1/1,元日
 *   2027/1/11,成人の日
 *   ...
 *
 * このCSVは過去〜翌年分の「確定値」（春分・秋分・うるう年含む）を持つため、
 * 自前の日付計算はせず CSV を正として取り込む。
 *
 * ネットワーク取得（fetch + Shift_JIS デコード）は lib/holidays/fetch.ts に分離。
 * ここは「変換済み UTF-8 文字列 → upsert 対象行」の純変換だけを担い、単体テストできる。
 */

/** japan_holidays への upsert 1行（テーブル: holiday_date PK / name） */
export interface HolidayRow {
  holiday_date: string // YYYY-MM-DD
  name: string
}

export interface HolidaySummary {
  count: number
  minYear: number | null
  maxYear: number | null
}

/** Shift_JIS のバイト列を UTF-8 文字列へデコード（Node full-ICU / ブラウザ標準の TextDecoder） */
export function decodeShiftJis(buf: ArrayBuffer | Uint8Array): string {
  return new TextDecoder('shift_jis').decode(buf)
}

/** "YYYY/M/D" → "YYYY-MM-DD"。形式外（ヘッダ等）は null */
function normalizeDate(s: string): string | null {
  const m = s.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return null
  const [, y, mo, d] = m
  return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`
}

/**
 * 変換済み CSV 文字列を解析して upsert 対象行を返す。
 * - ヘッダー行・空行・日付でない行はスキップ
 * - 同一日付が複数あれば最初の1件を採用（冪等）
 * - CRLF / LF どちらの改行にも対応
 */
export function parseHolidayCsv(csv: string): HolidayRow[] {
  const rows: HolidayRow[] = []
  const seen = new Set<string>()

  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    const commaIdx = line.indexOf(',')
    if (commaIdx < 0) continue
    const datePart = line.slice(0, commaIdx)
    const name = line.slice(commaIdx + 1).trim()

    const holiday_date = normalizeDate(datePart)
    if (!holiday_date || !name) continue // ヘッダー「国民の祝日・休日月日」等はここで除外
    if (seen.has(holiday_date)) continue

    seen.add(holiday_date)
    rows.push({ holiday_date, name })
  }

  return rows
}

/** 取り込み結果の要約（件数・対象年範囲）。ログ・audit_logs 記録用 */
export function summarizeHolidays(rows: HolidayRow[]): HolidaySummary {
  if (rows.length === 0) return { count: 0, minYear: null, maxYear: null }
  const years = rows.map((r) => Number(r.holiday_date.slice(0, 4)))
  return { count: rows.length, minYear: Math.min(...years), maxYear: Math.max(...years) }
}
