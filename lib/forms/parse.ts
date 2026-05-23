import type { ZodIssue, ZodTypeAny, infer as zInfer } from 'zod'

/**
 * Server Action 共通の FormData パーサー。
 *
 * - parse() ではなく safeParse() を使うので例外が出ず Runtime Error 画面に飛ばない
 * - 失敗時は fieldErrors（フィールド名 → エラーメッセージ配列）を構造化して返す
 * - 成功時は zod の型推論結果 data をそのまま受け取れる
 *
 * 使い方:
 * ```ts
 * 'use server'
 * import { parseFormData } from '@/lib/forms/parse'
 * import { mySchema } from '@/lib/schemas/...'
 *
 * export async function myAction(formData: FormData): Promise<ActionState> {
 *   const parsed = parseFormData(mySchema, formData)
 *   if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
 *   // parsed.data は zod の z.infer<typeof mySchema> 型
 *   ...
 *   return { ok: true }
 * }
 * ```
 */

/** Server Action が返す共通ステート型。各機能のスキーマに合わせて拡張可能 */
export type ActionState<TFields extends string = string> =
  | undefined
  | { ok: true; message?: string }
  | {
      ok: false
      /** フォーム全体のエラー（DB エラーなど、特定フィールドに紐付かない）*/
      formError?: string
      /** フィールド別エラー: { email: ['必須'], password: ['8文字以上'] } 形式 */
      fieldErrors?: Partial<Record<TFields, string[]>>
    }

/** parseFormData の結果型 */
export type ParseResult<TSchema extends ZodTypeAny> =
  | { ok: true; data: zInfer<TSchema> }
  | { ok: false; fieldErrors: Record<string, string[]>; issues: ZodIssue[] }

/**
 * FormData を zod スキーマで検証して構造化結果を返す。
 *
 * @param schema  検証スキーマ（`z.object({...})` ベース）
 * @param formData  Server Action が受け取る FormData
 */
export function parseFormData<TSchema extends ZodTypeAny>(
  schema: TSchema,
  formData: FormData,
): ParseResult<TSchema> {
  const raw = Object.fromEntries(formData.entries())
  const result = schema.safeParse(raw)
  if (result.success) {
    return { ok: true, data: result.data }
  }
  const flat = result.error.flatten()
  // fieldErrors の値は (string[] | undefined) が混ざるので undefined を落として固定型に
  const fieldErrors: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(flat.fieldErrors)) {
    if (v && v.length > 0) fieldErrors[k] = v
  }
  return { ok: false, fieldErrors, issues: result.error.issues }
}

/**
 * formError と fieldErrors を組み立てて ActionState を返す簡易ヘルパー。
 * よくある「Supabase エラー → formError に流したい」パターン用。
 */
export function actionFail<TFields extends string = string>(
  formError: string,
): Extract<ActionState<TFields>, { ok: false }> {
  return { ok: false, formError }
}

export function actionOk<TFields extends string = string>(
  message?: string,
): Extract<ActionState<TFields>, { ok: true }> {
  return { ok: true, ...(message !== undefined ? { message } : {}) }
}
