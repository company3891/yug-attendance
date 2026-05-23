import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { UserForm } from '../user-form'
import { createUserAction } from '../actions'

export default async function NewUserPage() {
  const me = await requireRole('admin')
  const supabase = createClient()

  const [{ data: companies }, { data: stores }, { data: departments }] = await Promise.all([
    supabase.from('companies').select('id, name'),
    supabase.from('stores').select('id, name, company_id'),
    supabase.from('departments').select('id, name, store_id'),
  ])

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold text-tiffany-700">従業員を追加</h1>
        <UserForm
          mode="create"
          action={createUserAction}
          companies={companies ?? []}
          stores={stores ?? []}
          departments={departments ?? []}
          currentUserRole={me.role}
          defaults={{
            company_id: me.company_id ?? undefined,
            store_id: me.store_id ?? undefined,
            is_active: true,
          }}
        />
        </div>
      </main>
    </>
  )
}
