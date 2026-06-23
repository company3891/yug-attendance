'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/lib/forms/parse'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export interface HolidaySettingsValue {
  scheduled_holidays: number[]
  legal_holiday: number
  holiday_as: 'scheduled_holiday' | 'workday'
}

function ErrorMsg({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return <p className="text-xs text-destructive">{errors[0]}</p>
}

/**
 * 休日設定（holiday_settings）の編集フォーム。会社・店舗で共用。
 * 店舗スコープでは「会社デフォルト使用中／店舗で上書き中」を表示し、上書き解除も可能。
 */
export function HolidaySettingsEditor({
  saveAction,
  value,
  isOverriding,
  resetAction,
}: {
  saveAction: (formData: FormData) => Promise<ActionState>
  /** 現在の実効値（店舗未上書き時は会社デフォルト値を渡す） */
  value: HolidaySettingsValue
  /** 店舗スコープで上書き中か（解除ボタン表示判定）。会社スコープでは undefined */
  isOverriding?: boolean
  resetAction?: () => Promise<ActionState>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})
  const [selected, setSelected] = useState<number[]>(value.scheduled_holidays)

  const isStoreScope = resetAction !== undefined

  function toggle(d: number) {
    setSelected((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    const formData = new FormData(e.currentTarget)
    formData.set('scheduled_holidays', selected.join(','))
    startTransition(async () => {
      const result = await saveAction(formData)
      if (!result) return
      if (result.ok) {
        router.refresh()
        return
      }
      if (result.formError) setFormError(result.formError)
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    })
  }

  function handleReset() {
    if (!resetAction) return
    if (!window.confirm('店舗の休日設定の上書きを解除し、会社デフォルトに戻します。よろしいですか？')) return
    startTransition(async () => {
      await resetAction()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-tiffany-100 p-4">
      {isStoreScope && (
        <div className="flex items-center justify-between">
          <span
            className={[
              'rounded-full px-2 py-0.5 text-xs font-medium',
              isOverriding ? 'bg-tiffany-100 text-tiffany-700' : 'bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {isOverriding ? '店舗で上書き中' : '会社デフォルト使用中'}
          </span>
          {isOverriding && (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={isPending}>
              会社デフォルトに戻す
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>所定休日の曜日（複数選択可）</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              className={[
                'h-9 w-9 rounded-lg border text-sm',
                selected.includes(d)
                  ? 'border-tiffany-500 bg-tiffany-500 text-white'
                  : 'border-gray-300 bg-white text-gray-600',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <ErrorMsg errors={fieldErrors.scheduled_holidays} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="legal_holiday">法定休日の曜日</Label>
          <select
            id="legal_holiday"
            name="legal_holiday"
            defaultValue={value.legal_holiday}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            {WEEKDAYS.map((label, d) => (
              <option key={d} value={d}>
                {label}曜
              </option>
            ))}
          </select>
          <ErrorMsg errors={fieldErrors.legal_holiday} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="holiday_as">祝日の扱い</Label>
          <select
            id="holiday_as"
            name="holiday_as"
            defaultValue={value.holiday_as}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="scheduled_holiday">所定休日として扱う</option>
            <option value="workday">営業日（出勤日）として扱う</option>
          </select>
          <ErrorMsg errors={fieldErrors.holiday_as} />
        </div>
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? '保存中…' : '休日設定を保存'}
      </Button>
    </form>
  )
}
