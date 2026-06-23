'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/lib/forms/parse'

export interface WageHistoryRow {
  effective_from: string
  unit_wage: number
  job_description: string | null
}

function ErrorMsg({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return <p className="text-xs text-destructive">{errors[0]}</p>
}

const WAGE_TYPE_LABEL: Record<string, string> = { hourly: '時給', daily: '日給', monthly: '月給' }

/**
 * 従業員の給与設定。
 * - 給与種別（現在値）+ 個人別所定上書き（users.daily_work_minutes 流用）
 * - 給与単価・業務内容の発効日つき履歴（追加 + 一覧）
 */
export function WageSettingsClient({
  wageSettingsAction,
  wageHistoryAction,
  currentWageType,
  currentOverrideMinutes,
  history,
}: {
  wageSettingsAction: (formData: FormData) => Promise<ActionState>
  wageHistoryAction: (formData: FormData) => Promise<ActionState>
  currentWageType: 'hourly' | 'daily' | 'monthly' | null
  currentOverrideMinutes: number | null
  history: WageHistoryRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [settingsErr, setSettingsErr] = useState<Record<string, string[] | undefined>>({})
  const [histErr, setHistErr] = useState<Record<string, string[] | undefined>>({})
  const [histFormError, setHistFormError] = useState<string | null>(null)

  const sorted = [...history].sort((a, b) => b.effective_from.localeCompare(a.effective_from))

  function submitSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSettingsMsg(null)
    setSettingsErr({})
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await wageSettingsAction(formData)
      if (!result) return
      if (result.ok) {
        setSettingsMsg(result.message ?? '保存しました')
        router.refresh()
        return
      }
      if (result.fieldErrors) setSettingsErr(result.fieldErrors)
      if (result.formError) setSettingsMsg(result.formError)
    })
  }

  function submitHistory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHistFormError(null)
    setHistErr({})
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await wageHistoryAction(formData)
      if (!result) return
      if (result.ok) {
        form.reset()
        router.refresh()
        return
      }
      if (result.fieldErrors) setHistErr(result.fieldErrors)
      if (result.formError) setHistFormError(result.formError)
    })
  }

  return (
    <div className="space-y-8">
      {/* 給与種別・所定上書き（現在値） */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-tiffany-700">給与種別・所定設定</h3>
        <form onSubmit={submitSettings} className="grid gap-3 rounded-lg border border-tiffany-100 p-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="wage_type">給与種別</Label>
            <select
              id="wage_type"
              name="wage_type"
              defaultValue={currentWageType ?? ''}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">未設定</option>
              <option value="hourly">時給</option>
              <option value="daily">日給</option>
              <option value="monthly">月給</option>
            </select>
            <ErrorMsg errors={settingsErr.wage_type} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="scheduled_override_minutes">個人別の所定労働時間（分・任意）</Label>
            <Input
              id="scheduled_override_minutes"
              name="scheduled_override_minutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={currentOverrideMinutes ?? ''}
              placeholder="空欄なら店舗設定に従う"
            />
            <ErrorMsg errors={settingsErr.scheduled_override_minutes} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? '保存中…' : '保存'}
            </Button>
            {settingsMsg && <span className="text-sm text-muted-foreground">{settingsMsg}</span>}
          </div>
        </form>
      </section>

      {/* 給与単価履歴 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-tiffany-700">
          給与単価・業務内容（発効日つき履歴）
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">適用開始日</th>
                <th className="py-2 pr-4">単価</th>
                <th className="py-2 pr-4">業務内容</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-muted-foreground">
                    履歴がありません。
                  </td>
                </tr>
              )}
              {sorted.map((r) => (
                <tr key={r.effective_from} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{r.effective_from}</td>
                  <td className="py-2 pr-4">
                    ¥{r.unit_wage.toLocaleString('ja-JP')}
                    {currentWageType ? `／${WAGE_TYPE_LABEL[currentWageType]}` : ''}
                  </td>
                  <td className="py-2 pr-4">{r.job_description ?? '－'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={submitHistory} className="grid gap-3 rounded-lg border border-tiffany-100 p-4 md:grid-cols-3">
          <p className="md:col-span-3 text-sm font-medium text-tiffany-700">単価を追加（適用開始日つき）</p>
          <div className="space-y-1">
            <Label htmlFor="wh_effective_from">適用開始日 *</Label>
            <Input id="wh_effective_from" name="effective_from" type="date" required />
            <ErrorMsg errors={histErr.effective_from} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wh_unit_wage">単価（円）*</Label>
            <Input id="wh_unit_wage" name="unit_wage" type="number" min={0} required />
            <ErrorMsg errors={histErr.unit_wage} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wh_job">業務内容（任意）</Label>
            <Input id="wh_job" name="job_description" type="text" maxLength={200} />
            <ErrorMsg errors={histErr.job_description} />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? '保存中…' : '単価を追加'}
            </Button>
            {histFormError && <span className="ml-3 text-sm text-destructive">{histFormError}</span>}
          </div>
          <p className="md:col-span-3 text-xs text-muted-foreground">
            ※ 最新の単価はレポートの「単価・概算支給額」に反映されます（給与種別が未設定の場合は反映されません）。
          </p>
        </form>
      </section>
    </div>
  )
}
