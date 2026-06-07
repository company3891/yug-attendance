import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/roles'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import type { AppUser } from '@/lib/database.types'
import type { UserActionState } from '@/lib/schemas/user'
import { UserForm } from '../user-form'
import { PasswordForm } from '../password-form'
import { changePasswordAction, updateUserAction } from '../actions'
import { UserEditTabs } from './user-edit-tabs'
import { AuthSettingsClient } from '../auth-settings-client'

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const me = await requireRole('admin')
  const supabase = createClient()
  const admin = createAdminClient()

  const { data, error } = await supabase.from('users').select('*').eq('id', params.id).single()
  if (error || !data) notFound()
  const user = data as AppUser

  // メールアドレスは auth.users から取得（service_role 必須）
  const { data: authData } = await admin.auth.admin.getUserById(params.id)
  const email = authData.user?.email ?? ''

  const [{ data: companies }, { data: stores }, { data: departments }] = await Promise.all([
    supabase.from('companies').select('id, name'),
    supabase.from('stores').select('id, name, company_id'),
    supabase.from('departments').select('id, name, store_id'),
  ])

  const boundUpdate = updateUserAction.bind(null, params.id) as (
    fd: FormData,
  ) => Promise<UserActionState>
  const boundPassword = changePasswordAction.bind(null, params.id) as (
    fd: FormData,
  ) => Promise<UserActionState>

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-2xl font-semibold text-tiffany-700">従業員を編集</h1>
          <UserEditTabs
            basicContent={
              <div className="space-y-6">
                <UserForm
                  mode="edit"
                  action={boundUpdate}
                  companies={companies ?? []}
                  stores={stores ?? []}
                  departments={departments ?? []}
                  currentUserRole={me.role}
                  defaults={{
                    email,
                    name: user.name,
                    name_kana: user.name_kana ?? '',
                    employee_no: user.employee_no ?? '',
                    role: user.role,
                    job_title: user.job_title ?? '',
                    employment_type: user.employment_type ?? '',
                    hire_date: user.hire_date ?? '',
                    wage_type: (user.wage_type as 'hourly' | 'monthly' | 'daily' | null) ?? '',
                    hourly_wage: user.hourly_wage ?? '',
                    monthly_wage: user.monthly_wage ?? '',
                    daily_wage: user.daily_wage ?? '',
                    is_active: user.is_active,
                    company_id: user.company_id ?? '',
                    store_id: user.store_id ?? '',
                    department_id: user.department_id ?? '',
                  }}
                />
                <PasswordForm action={boundPassword} />
              </div>
            }
            authContent={
              <AuthSettingsClient
                userId={user.id}
                faceAuthEnabled={user.face_auth_enabled ?? false}
                voiceEnabled={user.voice_announcement_enabled ?? null}
                hasFaceData={!!user.face_descriptors}
                faceRegisteredAt={user.face_registered_at ?? null}
                faceFailedCount={user.face_failed_count ?? 0}
              />
            }
          />
        </div>
      </main>
    </>
  )
}
