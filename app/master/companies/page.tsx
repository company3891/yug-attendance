import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Company } from '@/lib/database.types'
import {
  WorkRuleEditor,
  type WorkRuleHistoryRow,
} from '@/components/settings/work-rule-editor'
import {
  HolidaySettingsEditor,
  type HolidaySettingsValue,
} from '@/components/settings/holiday-settings-editor'
import { addCompanyWorkRuleAction, saveCompanyHolidaySettingsAction } from './actions'

const DEFAULT_HOLIDAY: HolidaySettingsValue = {
  scheduled_holidays: [6],
  legal_holiday: 0,
  holiday_as: 'scheduled_holiday',
}

export default async function CompaniesPage() {
  const me = await requireRole('master')
  const supabase = createClient()

  const [{ data: companyRows }, { data: wrRows }, { data: hsRows }] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase
      .from('work_rules')
      .select('company_id, effective_from, scheduled_minutes, work_start, work_end, break_minutes')
      .eq('scope', 'company'),
    supabase
      .from('holiday_settings')
      .select('company_id, scheduled_holidays, legal_holiday, holiday_as')
      .eq('scope', 'company'),
  ])

  const companies = (companyRows ?? []) as Company[]
  const workRules = (wrRows ?? []) as Array<WorkRuleHistoryRow & { company_id: string }>
  const holidays = (hsRows ?? []) as Array<HolidaySettingsValue & { company_id: string }>

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-tiffany-700">会社管理</h1>
          <p className="text-sm text-muted-foreground">
            会社デフォルトの就業設定（発効日つき履歴）と休日設定を管理します（マスター専用）。
          </p>
        </div>

        <div className="space-y-8">
          {companies.map((c) => {
            const rules = workRules.filter((r) => r.company_id === c.id)
            const hs = holidays.find((h) => h.company_id === c.id)
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle>{c.name}</CardTitle>
                  {c.representative_name && (
                    <CardDescription>代表: {c.representative_name}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-tiffany-700">就業設定（会社デフォルト）</h3>
                    <WorkRuleEditor
                      addAction={addCompanyWorkRuleAction.bind(null, c.id)}
                      rules={rules}
                    />
                  </section>
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-tiffany-700">休日設定（会社デフォルト）</h3>
                    <HolidaySettingsEditor
                      saveAction={saveCompanyHolidaySettingsAction.bind(null, c.id)}
                      value={
                        hs
                          ? {
                              scheduled_holidays: hs.scheduled_holidays,
                              legal_holiday: hs.legal_holiday,
                              holiday_as: hs.holiday_as,
                            }
                          : DEFAULT_HOLIDAY
                      }
                    />
                  </section>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </>
  )
}
