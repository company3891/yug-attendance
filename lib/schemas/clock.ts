import { z } from 'zod'

/**
 * 打刻関連の入力スキーマ
 *
 * Phase 2 では QR 打刻のみ（method='qr'）。
 * Phase 3 で 'face' / Phase 10 で 'outside' が追加される。
 */

export const clockMethodSchema = z.enum(['qr', 'face', 'manual', 'outside'])

/** POST /api/clock のリクエストボディ */
export const clockRequestSchema = z.object({
  token: z.string().min(1, 'QRトークンが必要です'),
  method: clockMethodSchema.default('qr'),
  store_id: z.string().uuid('店舗IDが不正です'),
  // 任意: GPS 位置情報（Phase 10 外出打刻時に必須化）
  location_lat: z
    .preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().optional()),
  location_lng: z
    .preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().optional()),
})

export type ClockRequest = z.infer<typeof clockRequestSchema>

/** 打刻成功レスポンス */
export const clockSuccessSchema = z.object({
  ok: z.literal(true),
  event: z.enum(['clock_in', 'clock_out']),
  attendance_id: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  work_date: z.string(), // YYYY-MM-DD
  clocked_at: z.string(), // ISO8601
  labor_minutes: z.number().int().nullable(), // 退勤時のみ計算済み値、出勤時は null
})

export type ClockSuccessResponse = z.infer<typeof clockSuccessSchema>
