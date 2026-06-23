import { z } from 'zod'

/**
 * レポート出力リクエスト（GET クエリ）の検証スキーマ（単発処理専用）
 *
 * - 月 / 店舗 / 個人フィルタ + 形式(csv/excel) + クライアント名
 * - 店舗スコープ（非masterは自店固定）は Server 側で別途強制する
 */

const empty = (v: unknown) => (v === '' || v === null ? undefined : v)

export const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  store_id: z.preprocess(empty, z.string().uuid('店舗IDが不正です').optional()),
  user_id: z.preprocess(empty, z.string().uuid('従業員IDが不正です').optional()),
  format: z.enum(['csv', 'excel']).default('csv'),
  client_name: z.preprocess(empty, z.string().max(100).optional()),
})

export type ReportQuery = z.infer<typeof reportQuerySchema>
