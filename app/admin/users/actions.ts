'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { actionFail, actionOk, parseFormData, type ActionState } from '@/lib/forms/parse'
import type { Inserts } from '@/lib/database.types'
import {
  userCreateSchema,
  userUpdateSchema,
  userPasswordChangeSchema,
  type UserBase,
} from '@/lib/schemas/user'

type UserState = ActionState<
  | 'name' | 'name_kana' | 'employee_no' | 'role' | 'company_id' | 'store_id'
  | 'department_id' | 'job_title' | 'employment_type' | 'hire_date'
  | 'wage_type' | 'hourly_wage' | 'monthly_wage' | 'daily_wage'
  | 'is_active' | 'email' | 'password'
>

/** zod 検証済みデータから DB INSERT/UPDATE 可能な列だけ抜き出す */
function pickInsertable(parsed: UserBase): Omit<Inserts<'users'>, 'id'> {
  return {
    name: parsed.name,
    name_kana: parsed.name_kana ?? null,
    employee_no: parsed.employee_no ?? null,
    role: parsed.role,
    company_id: parsed.company_id ?? null,
    store_id: parsed.store_id ?? null,
    department_id: parsed.department_id ?? null,
    job_title: parsed.job_title ?? null,
    employment_type: parsed.employment_type ?? null,
    hire_date: parsed.hire_date ?? null,
    wage_type: parsed.wage_type ?? null,
    hourly_wage: parsed.wage_type === 'hourly' ? parsed.hourly_wage ?? null : null,
    monthly_wage: parsed.wage_type === 'monthly' ? parsed.monthly_wage ?? null : null,
    daily_wage: parsed.wage_type === 'daily' ? parsed.daily_wage ?? null : null,
    is_active: parsed.is_active,
  }
}

// ---------------------------------------------------------------------------
// 新規作成
// ---------------------------------------------------------------------------
export async function createUserAction(formData: FormData): Promise<UserState> {
  await requireRole('admin')

  const parsed = parseFormData(userCreateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const admin = createAdminClient()

  // 1) Auth ユーザー作成
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    return actionFail(`Auth作成エラー: ${authError?.message ?? '不明'}`)
  }

  // 2) public.users に INSERT（失敗時は auth をロールバック削除）
  // NOTE: @supabase/ssr 0.5 と postgrest-js 2.106 の型推論が噛み合わないため
  // ランタイムでは Database 型で守りつつ、コンパイル時は never cast で突破する。
  const insertRow: Inserts<'users'> = { id: authData.user.id, ...pickInsertable(parsed.data) }
  const { error: insertError } = await admin.from('users').insert(insertRow as never)
  if (insertError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return actionFail(`Users挿入エラー: ${insertError.message}`)
  }

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

// ---------------------------------------------------------------------------
// 編集（email/password は含めない）
// ---------------------------------------------------------------------------
export async function updateUserAction(
  userId: string,
  formData: FormData,
): Promise<UserState> {
  await requireRole('admin')

  const parsed = parseFormData(userUpdateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const supabase = createClient()
  const { error } = await supabase
    .from('users')
    .update(pickInsertable(parsed.data) as never)
    .eq('id', userId)
  if (error) return actionFail(error.message)

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirect('/admin/users')
}

// ---------------------------------------------------------------------------
// パスワード変更（別アクション）
// ---------------------------------------------------------------------------
export async function changePasswordAction(
  userId: string,
  formData: FormData,
): Promise<UserState> {
  await requireRole('admin')

  const parsed = parseFormData(userPasswordChangeSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
  })
  if (error) return actionFail(`パスワード変更エラー: ${error.message}`)

  return actionOk('パスワードを変更しました')
}

// ---------------------------------------------------------------------------
// 有効化 / 無効化（boolean トグルなので zod 不要）
// ---------------------------------------------------------------------------
export async function deactivateUserAction(userId: string) {
  await requireRole('admin')
  const supabase = createClient()
  await supabase.from('users').update({ is_active: false } as never).eq('id', userId)
  revalidatePath('/admin/users')
}

export async function activateUserAction(userId: string) {
  await requireRole('admin')
  const supabase = createClient()
  await supabase.from('users').update({ is_active: true } as never).eq('id', userId)
  revalidatePath('/admin/users')
}
