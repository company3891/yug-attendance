import { z } from 'zod'

/**
 * Phase 1 ユーザー入力スキーマ
 *
 * - 新規作成と編集で必要な項目が違う（email/password は新規時のみ必須）
 * - パスワード変更は別アクションに分離してフォームを汚さない
 * - parse() は使わず safeParse() でユーザーに優しいエラーを返す
 * - wage_type と対応する金額入力の整合性を superRefine でチェック
 */

// 空文字 → undefined に正規化（DBへ null として保存できるように）
const empty = (v: unknown) => (v === '' || v === null ? undefined : v)

/**
 * 給与種別ごとの推奨範囲。
 * 範囲外は zod では弾かず、UI 側で confirm ダイアログを出して
 * 「警告のうえ保存可能」とする運用。
 */
export const WAGE_RANGE = {
  hourly: { min: 500, max: 10_000, label: '時給' },
  monthly: { min: 100_000, max: 2_000_000, label: '月給' },
  daily: { min: 5_000, max: 100_000, label: '日給' },
} as const

export type WageType = keyof typeof WAGE_RANGE

/** 与えられた金額がその給与種別の推奨範囲内か */
export function isWageInRange(type: WageType, amount: number): boolean {
  const r = WAGE_RANGE[type]
  return amount >= r.min && amount <= r.max
}

const userBaseShape = {
  name: z.string().min(1, '氏名は必須です'),
  name_kana: z.preprocess(empty, z.string().optional()),
  employee_no: z.preprocess(empty, z.string().optional()),
  role: z.enum(['master', 'store', 'admin', 'employee'], {
    errorMap: () => ({ message: '権限を選択してください' }),
  }),
  company_id: z.preprocess(empty, z.string().uuid('会社IDが不正です').optional()),
  store_id: z.preprocess(empty, z.string().uuid('店舗IDが不正です').optional()),
  department_id: z.preprocess(empty, z.string().uuid('部門IDが不正です').optional()),
  job_title: z.preprocess(empty, z.string().optional()),
  employment_type: z.preprocess(empty, z.string().optional()),
  hire_date: z.preprocess(empty, z.string().optional()),
  wage_type: z.preprocess(empty, z.enum(['hourly', 'monthly', 'daily']).optional()),
  // 範囲は WAGE_RANGE で UI 側にも公開。範囲外は zod では弾かず、
  // フォーム側で confirm ダイアログを出して「警告のうえ保存可能」とする。
  hourly_wage: z.preprocess(empty, z.coerce.number().int().min(0, '0以上で入力').optional()),
  monthly_wage: z.preprocess(empty, z.coerce.number().int().min(0, '0以上で入力').optional()),
  daily_wage: z.preprocess(empty, z.coerce.number().int().min(0, '0以上で入力').optional()),
  is_active: z.preprocess(
    (v) => v === 'on' || v === true || v === 'true',
    z.boolean(),
  ),
}

/** wage_type と対応金額の整合性チェッカ（superRefine 用コールバック） */
type WageFields = {
  wage_type?: 'hourly' | 'monthly' | 'daily'
  hourly_wage?: number
  monthly_wage?: number
  daily_wage?: number
}
const wageRefine = (val: WageFields, ctx: z.RefinementCtx) => {
  if (val.wage_type === 'hourly' && val.hourly_wage == null) {
    ctx.addIssue({ code: 'custom', path: ['hourly_wage'], message: '時給を入力してください' })
  }
  if (val.wage_type === 'monthly' && val.monthly_wage == null) {
    ctx.addIssue({ code: 'custom', path: ['monthly_wage'], message: '月給を入力してください' })
  }
  if (val.wage_type === 'daily' && val.daily_wage == null) {
    ctx.addIssue({ code: 'custom', path: ['daily_wage'], message: '日給を入力してください' })
  }
}

const userBaseSchema = z.object(userBaseShape)

/** 新規作成用：email/password 必須 + wage 整合性 */
export const userCreateSchema = userBaseSchema
  .extend({
    email: z.string().email('正しいメールアドレスを入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上にしてください'),
  })
  .superRefine(wageRefine)

/** 編集用：email/password は含めない（email は不変、password は別フロー）+ wage 整合性 */
export const userUpdateSchema = userBaseSchema.superRefine(wageRefine)

/** パスワード変更用（管理者が他人のパスワードをリセット）*/
export const userPasswordChangeSchema = z.object({
  password: z.string().min(8, 'パスワードは8文字以上にしてください'),
})

export type UserBase = z.infer<typeof userBaseSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type UserPasswordChangeInput = z.infer<typeof userPasswordChangeSchema>

// ActionState は lib/forms/parse.ts の共通型を利用する。
// 後方互換のため UserActionState という名前で再エクスポートしておく。
export type { ActionState as UserActionState } from '@/lib/forms/parse'
