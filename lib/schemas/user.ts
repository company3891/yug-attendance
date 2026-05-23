import { z } from 'zod'

/**
 * Phase 1 ユーザー入力スキーマ
 *
 * - 新規作成と編集で必要な項目が違う（email/password は新規時のみ必須）
 * - パスワード変更は別アクションに分離してフォームを汚さない
 * - parse() は使わず safeParse() でユーザーに優しいエラーを返す
 */

// 空文字 → undefined に正規化（DBへ null として保存できるように）
const empty = (v: unknown) => (v === '' || v === null ? undefined : v)

const userBaseSchema = z.object({
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
  hourly_wage: z.preprocess(empty, z.coerce.number().int().min(0, '0以上で入力').optional()),
  is_active: z.preprocess(
    (v) => v === 'on' || v === true || v === 'true',
    z.boolean(),
  ),
})

/** 新規作成用：email/password 必須 */
export const userCreateSchema = userBaseSchema.extend({
  email: z.string().email('正しいメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上にしてください'),
})

/** 編集用：email/password は含めない（email は不変、password は別フロー） */
export const userUpdateSchema = userBaseSchema

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
