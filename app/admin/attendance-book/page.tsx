import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { resolveVisibleScope, NO_MATCH_UUID } from '@/lib/permissions/scope'

/**
 * 出勤簿 出力画面（入力UI）
 *
 * - 期間: from 〜 to（年月）／集計単位（人・事業所・会社）／事業所絞り込み／従業員 複数選択（チェックボックス）
 * - 「Excel出力」= GET /api/attendance-book（ファイル DL）、「印刷プレビュー」= /admin/attendance-book/preview
 * - どちらも同じ GET フォームを formAction 切り替えで送る。
 * - 給与レポート（/admin/reports）とは別機能。
 */
export default async function AttendanceBookPage() {
  const me = await requireRole('admin')
  const supabase = createClient()

  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // 可視スコープ統一: master=全店 / 会社(store)=自社全店 / 事業所(admin)=自店のみ
  const scope = resolveVisibleScope(me)

  // 事業所(店舗)候補
  let storeQuery = supabase.from('stores').select('id, name').order('name')
  if (scope.kind === 'company') storeQuery = storeQuery.eq('company_id', scope.companyId)
  else if (scope.kind === 'store') storeQuery = storeQuery.eq('id', scope.storeId)
  else if (scope.kind !== 'all') storeQuery = storeQuery.eq('id', NO_MATCH_UUID)
  const { data: storeRows } = await storeQuery
  const stores = (storeRows ?? []) as { id: string; name: string }[]

  // 従業員リスト（可視スコープで絞る）
  let userQuery = supabase.from('users').select('id, name, store_id').order('name')
  if (scope.kind === 'company') userQuery = userQuery.eq('company_id', scope.companyId)
  else if (scope.kind === 'store') userQuery = userQuery.eq('store_id', scope.storeId)
  else if (scope.kind !== 'all') userQuery = userQuery.eq('id', NO_MATCH_UUID)
  const { data: userRows } = await userQuery
  const users = (userRows ?? []) as { id: string; name: string; store_id: string | null }[]

  const showStoreFilter = scope.kind === 'all' || scope.kind === 'company' || scope.kind === 'store'

  const inputCls = 'w-full rounded-md border px-3 py-2 text-sm'
  const selectCls = 'w-full rounded-md border bg-white px-3 py-2 text-sm'

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-tiffany-700">出勤簿</h1>
          <p className="text-sm text-muted-foreground">
            出退勤記録を「出勤簿」形式（1シート＝従業員の1ヶ月）で出力・印刷します。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>出力条件</CardTitle>
          </CardHeader>
          <CardContent>
            {/* GET フォーム。Excel は /api/attendance-book、印刷は /admin/attendance-book/preview へ formAction 切替 */}
            <form method="get" target="_blank" className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="from" className="text-sm font-medium">
                    開始（年月）
                  </label>
                  <input
                    id="from"
                    type="month"
                    name="from"
                    defaultValue={ym}
                    required
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="to" className="text-sm font-medium">
                    終了（年月）
                  </label>
                  <input
                    id="to"
                    type="month"
                    name="to"
                    defaultValue={ym}
                    required
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="group_by" className="text-sm font-medium">
                    集計単位（並び順）
                  </label>
                  <select id="group_by" name="group_by" defaultValue="person" className={selectCls}>
                    <option value="person">人単位</option>
                    <option value="store">事業所単位</option>
                    <option value="company">会社単位</option>
                  </select>
                </div>

                {showStoreFilter && (
                  <div className="space-y-1 md:col-span-3">
                    <label htmlFor="store_id" className="text-sm font-medium">
                      事業所で絞り込み
                    </label>
                    <select id="store_id" name="store_id" defaultValue="" className={selectCls}>
                      <option value="">すべて（見える範囲）</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 従業員 複数選択（チェックボックス） */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  対象従業員（未選択なら見える範囲の全員）
                </legend>
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">対象の従業員がいません。</p>
                ) : (
                  <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-3 md:grid-cols-4">
                    {users.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-tiffany-50"
                      >
                        <input
                          type="checkbox"
                          name="user_ids"
                          value={u.id}
                          className="h-4 w-4 rounded border-gray-300 text-tiffany-600"
                        />
                        <span className="truncate">{u.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              {scope.kind === 'company' && (
                <p className="text-xs text-muted-foreground">
                  ※ 出力範囲は自社（全事業所）に限定されます。事業所を選ぶと絞り込めます。
                </p>
              )}
              {scope.kind === 'store' && (
                <p className="text-xs text-muted-foreground">
                  ※ 出力範囲は自分の事業所に限定されます。
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ※ 期間は最大 12 ヶ月。従業員 × 月ごとに1シート（1ページ）で出力します。
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  formAction="/api/attendance-book"
                  className="rounded-lg bg-tiffany-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-tiffany-600"
                >
                  Excel 出力
                </button>
                <button
                  type="submit"
                  formAction="/admin/attendance-book/preview"
                  className="rounded-lg border border-tiffany-500 px-5 py-2.5 text-sm font-medium text-tiffany-700 hover:bg-tiffany-50"
                >
                  印刷プレビュー
                </button>
                <span className="text-xs text-muted-foreground">
                  Excel は別タブでダウンロード、印刷プレビューは別タブで開きます。
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">出勤簿の列構成</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              日付 / 曜日 / 出勤 / 退勤 / 休憩 / 労働 / 所定内 / 所定外 / 深夜 / 深夜残業 / 法定休日
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              打刻の無い日・休みの日も含めて当月の全日を並べ、「－」で表示します。下部に出勤日数・各区分の合計を表示します。
              （概算支給額・単価・給与種別は含みません。給与計算用は「レポート」をご利用ください。）
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
