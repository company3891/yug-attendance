import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminReportsPage() {
  const me = await requireRole('admin')
  const supabase = createClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // 店舗リスト（master は全店、それ以外は自店のみ）
  let storeQuery = supabase.from('stores').select('id, name').order('name')
  if (me.role !== 'master') storeQuery = storeQuery.eq('id', me.store_id ?? '')
  const { data: storeRows } = await storeQuery
  const stores = (storeRows ?? []) as { id: string; name: string }[]

  // 従業員リスト（フィルタ用）。master は全員、それ以外は自店のみ
  let userQuery = supabase.from('users').select('id, name').order('name')
  if (me.role !== 'master') userQuery = userQuery.eq('store_id', me.store_id ?? '')
  const { data: userRows } = await userQuery
  const users = (userRows ?? []) as { id: string; name: string }[]

  const inputCls = 'w-full rounded-md border px-3 py-2 text-sm'
  const selectCls = 'w-full rounded-md border bg-white px-3 py-2 text-sm'

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-tiffany-700">レポート出力</h1>
          <p className="text-sm text-muted-foreground">
            勤怠の全項目を CSV / Excel で出力します（給与計算用・全項目入り）。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>出力条件</CardTitle>
          </CardHeader>
          <CardContent>
            {/* GET フォーム → /api/reports がファイルを返す（ブラウザがダウンロード） */}
            <form method="get" action="/api/reports" className="space-y-5" target="_blank">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="year" className="text-sm font-medium">
                    年
                  </label>
                  <input
                    id="year"
                    type="number"
                    name="year"
                    defaultValue={year}
                    min={2000}
                    max={2100}
                    required
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="month" className="text-sm font-medium">
                    月
                  </label>
                  <select id="month" name="month" defaultValue={month} className={selectCls}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}月
                      </option>
                    ))}
                  </select>
                </div>

                {me.role === 'master' && (
                  <div className="space-y-1">
                    <label htmlFor="store_id" className="text-sm font-medium">
                      店舗
                    </label>
                    <select id="store_id" name="store_id" defaultValue="" className={selectCls}>
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
                  <label htmlFor="user_id" className="text-sm font-medium">
                    従業員
                  </label>
                  <select id="user_id" name="user_id" defaultValue="" className={selectCls}>
                    <option value="">全員</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="format" className="text-sm font-medium">
                    形式
                  </label>
                  <select id="format" name="format" defaultValue="csv" className={selectCls}>
                    <option value="csv">CSV（経理・給与ソフト取込用）</option>
                    <option value="excel">Excel（整形済み・人別シート）</option>
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label htmlFor="client_name" className="text-sm font-medium">
                    クライアント名（Excel ヘッダーに差し込み）
                  </label>
                  <input
                    id="client_name"
                    type="text"
                    name="client_name"
                    placeholder="例: 株式会社〇〇 御中"
                    maxLength={100}
                    className={inputCls}
                  />
                </div>
              </div>

              {me.role !== 'master' && (
                <p className="text-xs text-muted-foreground">
                  ※ 出力範囲は自店舗に限定されます。
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-tiffany-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-tiffany-600"
                >
                  ダウンロード
                </button>
                <span className="text-xs text-muted-foreground">
                  CSV は UTF-8 BOM 付き（Excel で文字化けしません）
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">出力される全項目</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              従業員名 / 店舗 / 勤務日 / 出勤 / 退勤 / 労働時間 / 所定内 / 所定外 / 法定外残業 /
              深夜 / 深夜残業 / 法定休日 / 給与種別 / 単価 / 概算支給額
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              ※ 概算支給額は work_time_calculations の労働時間区分と給与種別から算出した参考値です。
              実支給額は控除・各種手当を加味して確定します。
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
