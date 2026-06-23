import Link from 'next/link'
import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AppUser } from '@/lib/database.types'
import { UserCard } from '@/components/users/user-card'
import { activateUserAction, deactivateUserAction } from './actions'

type UserRow = Pick<
  AppUser,
  | 'id'
  | 'employee_no'
  | 'name'
  | 'role'
  | 'job_title'
  | 'employment_type'
  | 'is_active'
  | 'store_id'
  | 'department_id'
>

// 権限の表示ラベル（内部role名は不変。store=会社 / admin=事業所。docs/role-labels.md 参照）
const ROLE_LABEL: Record<string, string> = {
  master: 'マスター',
  store: '会社',
  admin: '事業所',
  employee: '従業員',
}

export default async function UsersListPage() {
  const me = await requireRole('admin')
  const supabase = createClient()

  let query = supabase
    .from('users')
    .select('id, employee_no, name, role, job_title, employment_type, is_active, store_id, department_id')
    .order('is_active', { ascending: false })
    .order('role', { ascending: false })

  if (me.role !== 'master' && me.company_id) {
    query = query.eq('company_id', me.company_id)
  }
  if (me.role === 'admin' && me.department_id) {
    query = query.eq('department_id', me.department_id)
  }

  const { data: rows, error } = await query
  const users = (rows ?? []) as UserRow[]

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-tiffany-700">従業員管理</h1>
            <p className="text-sm text-muted-foreground">従業員の追加・編集・無効化を行います。</p>
          </div>
          <Link href="/admin/users/new">
            <Button>新規追加</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>従業員一覧（{users.length}名）</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive">{error.message}</p>}

            {/* ▼ デスクトップ: テーブル（md以上） */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">No</th>
                    <th className="py-2 pr-4">氏名</th>
                    <th className="py-2 pr-4">権限</th>
                    <th className="py-2 pr-4">役職</th>
                    <th className="py-2 pr-4">雇用形態</th>
                    <th className="py-2 pr-4">状態</th>
                    <th className="py-2 pr-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{u.employee_no ?? '-'}</td>
                      <td className="py-2 pr-4 font-medium">{u.name}</td>
                      <td className="py-2 pr-4">{ROLE_LABEL[u.role] ?? u.role}</td>
                      <td className="py-2 pr-4">{u.job_title ?? '-'}</td>
                      <td className="py-2 pr-4">{u.employment_type ?? '-'}</td>
                      <td className="py-2 pr-4">
                        {u.is_active ? (
                          <span className="rounded-full bg-tiffany-100 px-2 py-0.5 text-xs text-tiffany-700">
                            有効
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            無効
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/admin/users/${u.id}`}>
                            <Button size="sm" variant="outline">
                              編集
                            </Button>
                          </Link>
                          {u.is_active ? (
                            <form action={deactivateUserAction.bind(null, u.id)}>
                              <Button size="sm" variant="ghost" type="submit">
                                無効化
                              </Button>
                            </form>
                          ) : (
                            <form action={activateUserAction.bind(null, u.id)}>
                              <Button size="sm" variant="ghost" type="submit">
                                有効化
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ▼ モバイル: カード型リスト（md未満） */}
            <div className="space-y-3 md:hidden">
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground">該当する従業員がいません。</p>
              )}
              {users.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  deactivateAction={deactivateUserAction}
                  activateAction={activateUserAction}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
