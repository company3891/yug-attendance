import { z } from 'zod'

/**
 * Phase 5 設定・マスタ用スキーマ
 *
 * 規約: create（追加）と update（現在値編集）を分離する。
 * - work_rules / user_wage_history は「発効日つき追加」= create スキーマ
 * - holiday_settings / users の給与種別・所定上書きは「現在値更新」= update スキーマ
 *
 * 注意: parseFormData は Object.fromEntries で重複キーを潰すため、複数選択
 * （所定休日の曜日）は CSV 文字列（例 "0,6"）で受け取り preprocess で number[] に変換する。
 */

const empty = (v: unknown) => (v === '' || v === null ? undefined : v)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '適用開始日は YYYY-MM-DD 形式で入力してください')
const timeStr = z.preprocess(
  empty,
  z.string().regex(/^\d{2}:\d{2}$/, '時刻は HH:MM 形式で入力してください').optional(),
)

// CSV("0,6") or 既に配列 → number[] (0..6)
const weekdayCsv = z.preprocess(
  (v) => {
    if (v === '' || v == null) return []
    if (Array.isArray(v)) return v
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean).map(Number)
    return v
  },
  z.array(z.number().int().min(0).max(6)),
)

// ---------------------------------------------------------------------------
// work_rules: 就業設定の発効日つき追加（会社/店舗共通）
// ---------------------------------------------------------------------------
export const workRuleCreateSchema = z
  .object({
    effective_from: dateStr,
    scheduled_minutes: z.coerce
      .number({ invalid_type_error: '所定労働時間（分）を入力してください' })
      .int()
      .min(1, '所定労働時間は1分以上')
      .max(1440, '所定労働時間は1440分以内'),
    work_start: timeStr,
    work_end: timeStr,
    break_minutes: z.preprocess(
      (v) => (v === '' || v == null ? 0 : v),
      z.coerce.number().int().min(0, '休憩は0以上').max(1440, '休憩は1440分以内'),
    ),
  })
  .superRefine((val, ctx) => {
    if (val.work_start && val.work_end && val.work_end <= val.work_start) {
      ctx.addIssue({ code: 'custom', path: ['work_end'], message: '終業は始業より後にしてください' })
    }
  })

export type WorkRuleCreateInput = z.infer<typeof workRuleCreateSchema>

// ---------------------------------------------------------------------------
// holiday_settings: 休日の現在値更新（会社/店舗共通・upsert）
// ---------------------------------------------------------------------------
export const holidaySettingsUpdateSchema = z.object({
  scheduled_holidays: weekdayCsv,
  legal_holiday: z.coerce.number().int().min(0).max(6),
  holiday_as: z.enum(['scheduled_holiday', 'workday']),
})

export type HolidaySettingsUpdateInput = z.infer<typeof holidaySettingsUpdateSchema>

// ---------------------------------------------------------------------------
// user_wage_history: 給与単価・業務内容の発効日つき追加
// ---------------------------------------------------------------------------
export const wageHistoryCreateSchema = z.object({
  effective_from: dateStr,
  unit_wage: z.coerce
    .number({ invalid_type_error: '単価を入力してください' })
    .int()
    .min(0, '単価は0以上'),
  job_description: z.preprocess(empty, z.string().max(200, '業務内容は200文字以内').optional()),
})

export type WageHistoryCreateInput = z.infer<typeof wageHistoryCreateSchema>

// ---------------------------------------------------------------------------
// users: 給与種別・個人別所定上書き（現在値更新）
//   ※ 所定上書きは既存 users.daily_work_minutes を流用
// ---------------------------------------------------------------------------
export const userWageSettingsUpdateSchema = z.object({
  wage_type: z.preprocess(empty, z.enum(['hourly', 'daily', 'monthly']).optional()),
  scheduled_override_minutes: z.preprocess(
    empty,
    z.coerce.number().int().min(1, '所定は1分以上').max(1440, '所定は1440分以内').optional(),
  ),
})

export type UserWageSettingsUpdateInput = z.infer<typeof userWageSettingsUpdateSchema>
