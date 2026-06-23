import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { canEditAttendance } from '@/lib/permissions/attendance'
import { AttendanceTable, type AttendanceRow } from './attendance-table'

interface SearchParams {
  year?: string
  month?: string
  store_id?: string
  user_id?: string
}

interface JoinedAttendance {
  id: string
  user_id: string
  store_id: string
  work_date: string
  clock_in: string | null
  clock_out: string | null
  break_minutes: number
  has_anomaly: boolean
  anomaly_codes: string[] | null
  users: { name: string } | { name: string }[] | null
  stores: { name: string } | { name: string }[] | null
  work_time_calculations:
    | { labor_minutes: number | null }
    | { labor_minutes: number | null }[]
    | null
}

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function AdminAttendancesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const me = await requireRole('admin')
  const supabase = createClient()

  const now = new Date()
  const year = Number(searchParams.year ?? now.getFullYear())
  const month = Number(searchParams.month ?? now.getMonth() + 1)

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  // --- 店舗リスト（フィルタ用）: master は全店、それ以外は自店のみ ---
  let storeQuery = supabase.from('stores').select('id, name').order('name')
  if (me.role !== 'master') {
    storeQuery = storeQuery.eq('id', me.store_id ?? '')
  }
  const { data: storeRows } = await storeQuery
  const stores = (storeRows ?? []) as { id: string; name: string }[]

  // 非 master は自店固定。master はフィルタ指定があればそれを使う。
  const effectiveStoreId =
    me.role === 'master' ? (searchParams.store_id || '') : (me.store_id ?? '')

  // --- 従業員リスト（フィルタ用）: 対象店舗に絞る ---
  let userQuery = supabase.from('users').select('id, name').order('name')
  if (effectiveStoreId) userQuery = userQuery.eq('store_id', effectiveStoreId)
  const { data: userRows } = await userQuery
  const users = (userRows ?? []) as { id: string; name: string }[]

  // --- 打刻データ取得 ---
  let attQuery = supabase
    .from('attendances')
    .select(
      // attendances→users は user_id / modified_by の2本のFKがあり曖昧（PGRST201）。
      // 打刻者本人を表示するので user_id のFK(attendances_user_id_fkey)を制約名で明示。
      'id, user_id, store_id, work_date, clock_in, clock_out, break_minutes, has_anomaly, anomaly_codes, users!attendances_user_id_fkey(name), stores(name), work_time_calculations(labor_minutes)',
    )
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: true })

  if (effectiveStoreId) attQuery = attQuery.eq('store_id', effectiveStoreId)
  if (searchParams.user_id) attQuery = attQuery.eq('user_id', searchParams.user_id)

  const { data: attRows, error } = await attQuery
  const joined = (attRows ?? []) as unknown as JoinedAttendance[]

  const rows: AttendanceRow[] = joined.map((r) => ({
    id: r.id,
    userName: one(r.users)?.name ?? '(不明)',
    storeName: one(r.stores)?.name ?? '(不明)',
    workDate: r.work_date,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
    breakMinutes: r.break_minutes ?? 0,
    laborMinutes: one(r.work_time_calculations)?.labor_minutes ?? null,
    hasAnomaly: r.has_anomaly ?? false,
    anomalyCodes: r.anomaly_codes ?? [],
    canEdit: canEditAttendance({
      actorRole: me.role,
      actorStoreId: me.store_id,
      targetStoreId: r.store_id,
    }),
  }))

  // 前月・翌月リンク
  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const qs = (y: number, m: number) => {
    const p = new URLSearchParams()
    p.set('year', String(y))
    p.set('month', String(m))
    if (me.role === 'master' && effectiveStoreId) p.set('store_id', effectiveStoreId)
    if (searchParams.user_id) p.set('user_id', searchParams.user_id)
    return `/admin/attendances?${p.toString()}`
  }

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-tiffany-700">打刻一覧</h1>
          <p className="text-sm text-muted-foreground">
            打刻の確認・修正を行います（master/店舗管理/部門管理）。
          </p>
        </div>

        {/* フィルタバー（GET フォーム） */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form method="get" className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">年</label>
                <input
                  type="number"
                  name="year"
                  defaultValue={year}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">月</label>
                <select
                  name="month"
                  defaultValue={month}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </div>

              {me.role === 'master' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">店舗</label>
                  <select
                    name="store_id"
                    defaultValue={effectiveStoreId}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">全店舗</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">従業員</label>
                <select
                  name="user_id"
                  defaultValue={searchParams.user_id ?? ''}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                >
                  <option value="">全員</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <button
                  type="submit"
                  className="rounded-lg bg-tiffany-500 px-4 py-2 text-sm font-medium text-white hover:bg-tiffany-600"
                >
                  絞り込み
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {year}年{month}月（{rows.length}件）
            </CardTitle>
            <div className="flex gap-2 text-sm">
              <a href={qs(prevDate.getFullYear(), prevDate.getMonth() + 1)} className="text-tiffany-600 hover:underline">
                ← 前月
              </a>
              <a href={qs(nextDate.getFullYear(), nextDate.getMonth() + 1)} className="text-tiffany-600 hover:underline">
                翌月 →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {error && <p className="mb-3 text-sm text-destructive">{error.message}</p>}
            <AttendanceTable rows={rows} />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
