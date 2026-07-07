import { z } from 'zod'

/**
 * 出勤簿出力リクエスト（GET クエリ）の検証スキーマ（単発処理専用）
 *
 * - 期間は年月単位で from 〜 to（"YYYY-MM"）。日単位は不要。
 * - 従業員は複数選択（user_ids）。空なら可視スコープ内の全員。
 * - group_by: 人単位 / 事業所単位 / 会社単位（シートの並び順のみに作用）。
 * - 店舗スコープ（非master は自店固定）は Server 側で別途強制する。
 * - user_ids は同名パラメータの繰り返し（getAll）で受け取るため、ここでは検証しない。
 */

const empty = (v: unknown) => (v === '' || v === null ? undefined : v)

export const attendanceBookQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'from は YYYY-MM 形式です'),
  to: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'to は YYYY-MM 形式です'),
  store_id: z.preprocess(empty, z.string().uuid('店舗IDが不正です').optional()),
  group_by: z.enum(['person', 'store', 'company']).default('person'),
  format: z.enum(['excel']).default('excel'),
})

export type AttendanceBookQuery = z.infer<typeof attendanceBookQuerySchema>

/** "YYYY-MM" → {year, month} */
export function parseYearMonth(s: string): { year: number; month: number } {
  const [y, m] = s.split('-')
  return { year: Number(y), month: Number(m) }
}

/** 期間の月数（両端含む）。from > to は 0 */
export function monthSpan(from: { year: number; month: number }, to: { year: number; month: number }): number {
  const diff = (to.year - from.year) * 12 + (to.month - from.month)
  return diff < 0 ? 0 : diff + 1
}

/** 出勤簿で許可する最大期間（月数）。過大な出力を防ぐ */
export const MAX_BOOK_MONTHS = 12
