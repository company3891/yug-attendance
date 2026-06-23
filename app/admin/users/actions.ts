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
import {
  wageHistoryCreateSchema,
  userWageSettingsUpdateSchema,
} from '@/lib/schemas/settings'
import { latestWage, type WageHistoryRow } from '@/lib/settings/wage'

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

// ===========================================================================
// Phase 5: 給与設定（master/store・自社のみ）
// ===========================================================================

export type WageSettingsState = ActionState<'wage_type' | 'scheduled_override_minutes'>
export type WageHistoryState = ActionState<'effective_from' | 'unit_wage' | 'job_description'>

const WAGE_COLUMN = { hourly: 'hourly_wage', daily: 'daily_wage', monthly: 'monthly_wage' } as const

/** 対象ユーザーが操作者の権限範囲か（master=全社、store=自社のみ）。me は requireRole('store') の戻り */
async function assertUserScope(
  admin: ReturnType<typeof createAdminClient>,
  me: { role: string; company_id: string | null },
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: u } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()
  if (!u) return { ok: false, message: '対象の従業員が見つかりません' }
  if (me.role !== 'master' && me.company_id !== (u as { company_id: string | null }).company_id) {
    return { ok: false, message: '他社の従業員は操作できません' }
  }
  return { ok: true }
}

/** 給与種別（現在値）と個人別所定上書き（users.daily_work_minutes 流用）を更新 */
export async function updateUserWageSettingsAction(
  userId: string,
  formData: FormData,
): Promise<WageSettingsState> {
  const me = await requireRole('store')
  const admin = createAdminClient()
  const scope = await assertUserScope(admin, me, userId)
  if (!scope.ok) return actionFail(scope.message)

  const parsed = parseFormData(userWageSettingsUpdateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  // before（監査用）
  const { data: before } = await admin
    .from('users')
    .select('wage_type, daily_work_minutes')
    .eq('id', userId)
    .maybeSingle()

  const { error } = await admin
    .from('users')
    .update({
      wage_type: parsed.data.wage_type ?? null,
      daily_work_minutes: parsed.data.scheduled_override_minutes ?? null,
    } as never)
    .eq('id', userId)
  if (error) return actionFail(error.message)

  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'user.wage_change',
    resource_type: 'users',
    resource_id: userId,
    before_data: before ?? null,
    after_data: {
      wage_type: parsed.data.wage_type ?? null,
      daily_work_minutes: parsed.data.scheduled_override_minutes ?? null,
    },
  } as never)

  revalidatePath(`/admin/users/${userId}`)
  return actionOk('給与種別・所定設定を保存しました')
}

/** 給与単価・業務内容を発効日つきで追加し、最新行を users 現在値カラムへ同期、監査記録 */
export async function addUserWageHistoryAction(
  userId: string,
  formData: FormData,
): Promise<WageHistoryState> {
  const me = await requireRole('store')
  const admin = createAdminClient()
  const scope = await assertUserScope(admin, me, userId)
  if (!scope.ok) return actionFail(scope.message)

  const parsed = parseFormData(wageHistoryCreateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  // 追加前の最新単価（監査の before 用）
  const { data: prevRows } = await admin
    .from('user_wage_history')
    .select('effective_from, unit_wage, job_description')
    .eq('user_id', userId)
  const prevLatest = latestWage((prevRows ?? []) as WageHistoryRow[])

  const { error: insErr } = await admin.from('user_wage_history').insert({
    user_id: userId,
    effective_from: parsed.data.effective_from,
    unit_wage: parsed.data.unit_wage,
    job_description: parsed.data.job_description ?? null,
  } as never)
  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: false, fieldErrors: { effective_from: ['同じ適用開始日の履歴が既に存在します'] } }
    }
    return actionFail(insErr.message)
  }

  // 最新行を users の現在値カラムへ同期（レポートは無改修で最新単価を参照）
  const { data: u } = await admin.from('users').select('wage_type').eq('id', userId).maybeSingle()
  const wageType = (u as { wage_type: string | null } | null)?.wage_type ?? null
  const { data: allRows } = await admin
    .from('user_wage_history')
    .select('effective_from, unit_wage, job_description')
    .eq('user_id', userId)
  const latest = latestWage((allRows ?? []) as WageHistoryRow[])
  if (wageType && wageType in WAGE_COLUMN && latest) {
    const col = WAGE_COLUMN[wageType as keyof typeof WAGE_COLUMN]
    await admin.from('users').update({ [col]: latest.unit_wage } as never).eq('id', userId)
  }

  // 監査: 給与単価変更
  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'user.wage_change',
    resource_type: 'users',
    resource_id: userId,
    before_data: prevLatest ? { unit_wage: prevLatest.unit_wage, effective_from: prevLatest.effective_from } : null,
    after_data: { unit_wage: parsed.data.unit_wage, effective_from: parsed.data.effective_from },
  } as never)

  revalidatePath(`/admin/users/${userId}`)
  return actionOk('給与単価を追加しました')
}
