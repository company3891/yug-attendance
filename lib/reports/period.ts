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
