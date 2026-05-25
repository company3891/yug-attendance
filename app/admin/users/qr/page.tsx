import Link from 'next/link'
import { requireRole } from '@/lib/auth/roles'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'
import { QrDisplay } from '@/components/qr/qr-display'
import { generateQrToken } from '@/lib/qr/generator'
import { isQrUpdateRecommended } from '@/lib/qr/verifier'
import { PrintButton, QrActionsClient } from './qr-actions-client'

type UserRow = {
  id: string
  employee_no: string | null
  name: string
  is_active: boolean
  store_id: string | null
  qr_version: number
  qr_issued_at: string | null
  qr_revoked_at: string | null
}

type StoreRow = { id: string; qr_secret: string; name: string }

export default async function UsersQrPage() {
  const me = await requireRole('admin')
  const supabase = createClient()
  const admin = createAdminClient()

  // ログインユーザーの会社配下の従業員のみ
  let usersQ = supabase
    .from('users')
    .select('id, employee_no, name, is_active, store_id, qr_version, qr_issued_at, qr_revoked_at')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
  if (me.company_id) usersQ = usersQ.eq('company_id', me.company_id)
  if (me.role === 'admin' && me.department_id) usersQ = usersQ.eq('department_id', me.department_id)
  const { data: usersRaw } = await usersQ
  const users = (usersRaw ?? []) as unknown as UserRow[]

  // qr_secret を取得（admin clientでのみアクセス可、サーバー内に閉じる）
  const { data: storesRaw } = await admin.from('stores').select('id, qr_secret, name')
  const stores = (storesRaw ?? []) as unknown as StoreRow[]
  const storeById = new Map(stores.map((s) => [s.id, s]))

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64 print:ml-0 print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-semibold text-tiffany-700">QRコード管理</h1>
            <p className="text-sm text-muted-foreground">
              個人QRの発行・印刷・失効。印刷は右の「印刷」ボタンから。
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/users">
              <Button variant="outline">従業員管理に戻る</Button>
            </Link>
            <PrintButton />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
          {users.map((u) => {
            if (!u.store_id) return null
            const store = storeById.get(u.store_id)
            if (!store) return null

            const issuedAtIso = u.qr_issued_at ?? new Date().toISOString()
            const issuedAtSec = Math.floor(new Date(issuedAtIso).getTime() / 1000)
            const token = generateQrToken(
              {
                store_id: u.store_id,
                user_id: u.id,
                qr_version: u.qr_version,
                issued_at: issuedAtSec,
              },
              store.qr_secret,
            )

            const needsUpdate = isQrUpdateRecommended(u.qr_issued_at)
            const isRevoked = u.qr_revoked_at !== null
            const isUnissued = u.qr_issued_at === null

            return (
              <div key={u.id} className="space-y-2">
                <QrDisplay
                  token={token}
                  size={160}
                  printable
                  label={u.name}
                  subLabel={u.employee_no ? `No. ${u.employee_no}` : undefined}
                />
                <div className="flex flex-wrap items-center gap-1 print:hidden">
                  {!u.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      無効
                    </span>
                  )}
                  {isRevoked && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      QR失効
                    </span>
                  )}
                  {isUnissued && (
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-foreground">
                      未発行
                    </span>
                  )}
                  {needsUpdate && !isRevoked && (
                    <span className="rounded-full bg-gold/30 px-2 py-0.5 text-xs text-foreground">
                      更新推奨（3年経過）
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">v{u.qr_version}</span>
                </div>
                <QrActionsClient userId={u.id} isRevoked={isRevoked} isUnissued={isUnissued} />
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}

