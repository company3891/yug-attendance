import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { minutesToHourMinute } from '@/lib/datetime'
import {
  WorkRuleEditor,
  type WorkRuleHistoryRow,
} from '@/components/settings/work-rule-editor'
import {
  HolidaySettingsEditor,
  type HolidaySettingsValue,
} from '@/components/settings/holiday-settings-editor'
import {
  addStoreWorkRuleAction,
  resetStoreWorkRulesAction,
  saveStoreHolidaySettingsAction,
  resetStoreHolidaySettingsAction,
} from './actions'

const DEFAULT_HOLIDAY: HolidaySettingsValue = {
  scheduled_holidays: [6],
  legal_holiday: 0,
  holiday_as: 'scheduled_holiday',
}

type WRRow = WorkRuleHistoryRow & { scope: string; company_id: string; store_id: string | null }
type HSRow = HolidaySettingsValue & { scope: string; company_id: string; store_id: string | null }

export default async function StoresPage() {
  const me = await requireRole('master')
  const supabase = createClient()

  const [{ data: storeRows }, { data: wrRows }, { data: hsRows }] = await Promise.all([
    supabase.from('stores').select('id, name, company_id').order('name'),
    supabase
      .from('work_rules')
      .select('scope, company_id, store_id, effective_from, scheduled_minutes, work_start, work_end, break_minutes'),
    supabase
      .from('holiday_settings')
      .select('scope, company_id, store_id, scheduled_holidays, legal_holiday, holiday_as'),
  ])

  const stores = (storeRows ?? []) as { id: string; name: string; company_id: string }[]
  const workRules = (wrRows ?? []) as WRRow[]
  const holidays = (hsRows ?? []) as HSRow[]

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-tiffany-700">店舗管理</h1>
          <p className="text-sm text-muted-foreground">
            店舗ごとに就業設定・休日設定を会社デフォルトから上書きできます（マスター専用）。
          </p>
        </div>

        <div className="space-y-8">
          {stores.map((s) => {
            const storeRules = workRules.filter((r) => r.scope === 'store' && r.store_id === s.id)
            const companyRules = workRules.filter(
              (r) => r.scope === 'company' && r.company_id === s.company_id,
            )
            const isWrOverriding = storeRules.length > 0

            const storeHs = holidays.find((h) => h.scope === 'store' && h.store_id === s.id)
            const companyHs = holidays.find((h) => h.scope === 'company' && h.company_id === s.company_id)
            const isHsOverriding = !!storeHs
            const effectiveHs = storeHs ?? companyHs ?? DEFAULT_HOLIDAY

            return (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle>{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* 就業設定 */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-tiffany-700">就業設定</h3>
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          isWrOverriding
                            ? 'bg-tiffany-100 text-tiffany-700'
                            : 'bg-muted text-muted-foreground',
                        ].join(' ')}
                      >
                        {isWrOverriding ? '店舗で上書き中' : '会社デフォルト使用中'}
                      </span>
                    </div>

                    {!isWrOverriding && (
                      <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                        <div className="mb-1 font-medium">現在の会社デフォルト:</div>
                        {companyRules.length === 0 ? (
                          <span>未設定</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {[...companyRules]
                              .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
                              .map((r) => (
                                <li key={r.effective_from} className="font-mono">
                                  {r.effective_from}〜 所定{minutesToHourMinute(r.scheduled_minutes)}／休憩{r.break_minutes}分
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <WorkRuleEditor
                      addAction={addStoreWorkRuleAction.bind(null, s.id)}
                      rules={storeRules}
                      isOverriding={isWrOverriding}
                      resetAction={resetStoreWorkRulesAction.bind(null, s.id)}
                    />
                  </section>

                  {/* 休日設定 */}
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-tiffany-700">休日設定</h3>
                    <HolidaySettingsEditor
                      saveAction={saveStoreHolidaySettingsAction.bind(null, s.id)}
                      value={effectiveHs}
                      isOverriding={isHsOverriding}
                      resetAction={resetStoreHolidaySettingsAction.bind(null, s.id)}
                    />
                  </section>
                </CardContent>
              </Card>
            )
          })}
          {stores.length === 0 && (
            <p className="text-sm text-muted-foreground">店舗がありません。</p>
          )}
        </div>
      </main>
    </>
  )
}
