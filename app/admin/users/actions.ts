'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'

const userSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上').optional().or(z.literal('')),
  name: z.string().min(1, '氏名は必須です'),
  name_kana: z.string().optional(),
  employee_no: z.string().optional(),
  role: z.enum(['master', 'store', 'admin', 'employee']),
  company_id: z.string().uuid().optional().or(z.literal('')),
  store_id: z.string().uuid().optional().or(z.literal('')),
  department_id: z.string().uuid().optional().or(z.literal('')),
  job_title: z.string().optional(),
  employment_type: z.string().optional(),
  hire_date: z.string().optional(),
  wage_type: z.enum(['hourly', 'monthly', 'daily']).optional().or(z.literal('')),
  hourly_wage: z.coerce.number().optional().or(z.literal('')),
  is_active: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()),
})

function pickInsertable(parsed: z.infer<typeof userSchema>) {
  return {
    name: parsed.name,
    name_kana: parsed.name_kana || null,
    employee_no: parsed.employee_no || null,
    role: parsed.role,
    company_id: parsed.company_id || null,
    store_id: parsed.store_id || null,
    department_id: parsed.department_id || null,
    job_title: parsed.job_title || null,
    employment_type: parsed.employment_type || null,
    hire_date: parsed.hire_date || null,
    wage_type: parsed.wage_type || null,
    hourly_wage: parsed.hourly_wage === '' ? null : Number(parsed.hourly_wage),
    is_active: parsed.is_active,
  }
}

export async function createUserAction(formData: FormData) {
  await requireRole('admin')

  const raw = Object.fromEntries(formData.entries())
  const parsed = userSchema.parse(raw)

  if (!parsed.password) {
    return { error: '新規作成時はパスワード（8文字以上）が必須です' }
  }

  const admin = createAdminClient()

  // 1) Supabase Auth にユーザー作成
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    return { error: `Auth作成エラー: ${authError?.message ?? '不明'}` }
  }

  // 2) public.users に upsert
  const { error: insertError } = await admin
    .from('users')
    .insert({ id: authData.user.id, ...pickInsertable(parsed) })
  if (insertError) {
    // Authロールバック
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: `Users挿入エラー: ${insertError.message}` }
  }

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function updateUserAction(userId: string, formData: FormData) {
  await requireRole('admin')

  const raw = Object.fromEntries(formData.entries())
  const parsed = userSchema.parse({ ...raw, password: raw.password || '' })

  const supabase = createClient()
  const { error } = await supabase.from('users').update(pickInsertable(parsed)).eq('id', userId)
  if (error) return { error: error.message }

  // パスワード変更が指定された場合
  if (parsed.password) {
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(userId, { password: parsed.password })
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirect('/admin/users')
}

export async function deactivateUserAction(userId: string) {
  await requireRole('admin')
  const supabase = createClient()
  await supabase.from('users').update({ is_active: false }).eq('id', userId)
  revalidatePath('/admin/users')
}

export async function activateUserAction(userId: string) {
  await requireRole('admin')
  const supabase = createClient()
  await supabase.from('users').update({ is_active: true }).eq('id', userId)
  revalidatePath('/admin/users')
}
