/**
 * レポート期間のラベル・ファイル名生成（純関数）
 */

export function periodLabel(year: number, month: number): string {
  return `${year}年${month}月`
}

export function periodSlug(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** 月初・月末の "YYYY-MM-DD"（JST 基準の work_date 範囲） */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/** 指定月の全日を "YYYY-MM-DD"[]（1日〜月末・昇順）で返す。出勤簿の「全日並べ」に使用 */
export function eachDayOfMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  return Array.from(
    { length: lastDay },
    (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`,
  )
}

export interface YearMonth {
  year: number
  month: number
}

/** from..to（両端含む）の {year, month} を昇順で列挙。from > to の場合は空配列 */
export function eachMonthInRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = []
  let y = from.year
  let m = from.month
  while (y < to.year || (y === to.year && m <= to.month)) {
    out.push({ year: y, month: m })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** 出勤簿ファイル名用の期間スラッグ（単月なら "2026-04"、複数月なら "2026-04_2026-06"） */
export function bookPeriodSlug(from: YearMonth, to: YearMonth): string {
  const a = periodSlug(from.year, from.month)
  const b = periodSlug(to.year, to.month)
  return a === b ? a : `${a}_${b}`
}

/** 出勤簿ダウンロード用の Content-Disposition（日本語ファイル名 RFC5987 付き） */
export function bookContentDisposition(from: YearMonth, to: YearMonth): string {
  const slug = bookPeriodSlug(from, to)
  const ascii = `attendance-book_${slug}.xlsx`
  const ja = `出勤簿_${slug}.xlsx`
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(ja)}`
}

/** ダウンロード用ファイル名（拡張子込み、ASCII フォールバック用の英字名） */
export function reportFilename(year: number, month: number, ext: 'csv' | 'xlsx'): string {
  return `attendance-report_${periodSlug(year, month)}.${ext}`
}

/** Content-Disposition 用に日本語ファイル名を付与（filename* = RFC5987） */
export function contentDisposition(year: number, month: number, ext: 'csv' | 'xlsx'): string {
  const ascii = reportFilename(year, month, ext)
  const ja = `勤怠レポート_${periodSlug(year, month)}.${ext}`
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(ja)}`
}
