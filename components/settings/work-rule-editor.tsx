'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { minutesToHourMinute } from '@/lib/datetime'
import type { ActionState } from '@/lib/forms/parse'

export interface WorkRuleHistoryRow {
  effective_from: string
  scheduled_minutes: number
  work_start: string | null
  work_end: string | null
  break_minutes: number
}

function ErrorMsg({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return <p className="text-xs text-destructive">{errors[0]}</p>
}

/**
 * 就業設定（work_rules）の発効日つき追加フォーム + 履歴一覧。
 * 会社設定・店舗設定の両方で共用する。
 */
export function WorkRuleEditor({
  addAction,
  rules,
  isOverriding,
  resetAction,
}: {
  addAction: (formData: FormData) => Promise<ActionState>
  rules: WorkRuleHistoryRow[]
  /** 店舗スコープで上書き中か（reset ボタン表示判定） */
  isOverriding?: boolean
  /** 店舗の上書き解除（指定時のみ reset ボタン表示） */
  resetAction?: () => Promise<ActionState>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})

  const sorted = [...rules].sort((a, b) => b.effective_from.localeCompare(a.effective_from))

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await addAction(formData)
      if (!result) return
      if (result.ok) {
        form.reset()
        router.refresh()
        return
      }
      if (result.formError) setFormError(result.formError)
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    })
  }

  function handleReset() {
    if (!resetAction) return
    if (!window.confirm('店舗の就業設定の上書きを解除し、会社デフォルトに戻します。よろしいですか？')) return
    startTransition(async () => {
      await resetAction()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* 履歴一覧 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">適用開始日</th>
              <th className="py-2 pr-4">所定</th>
              <th className="py-2 pr-4">始業</th>
              <th className="py-2 pr-4">終業</th>
              <th className="py-2 pr-4">休憩</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-muted-foreground">
                  設定履歴がありません。
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.effective_from} className="border-b last:border-0">
                <td className="py-2 pr-4 font-mono">{r.effective_from}</td>
                <td className="py-2 pr-4">
                  {minutesToHourMinute(r.scheduled_minutes)}（{r.scheduled_minutes}分）
                </td>
                <td className="py-2 pr-4 font-mono">{r.work_start ?? '－'}</td>
                <td className="py-2 pr-4 font-mono">{r.work_end ?? '－'}</td>
                <td className="py-2 pr-4">{r.break_minutes}分</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOverriding && resetAction && (
        <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={isPending}>
          会社デフォルトに戻す（上書き解除）
        </Button>
      )}

      {/* 追加フォーム */}
      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-tiffany-100 p-4 md:grid-cols-2">
        <p className="md:col-span-2 text-sm font-medium text-tiffany-700">就業設定を追加（適用開始日つき）</p>
        <div className="space-y-1">
          <Label htmlFor="effective_from">適用開始日 *</Label>
          <Input id="effective_from" name="effective_from" type="date" required />
          <ErrorMsg errors={fieldErrors.effective_from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="scheduled_minutes">所定労働時間（分）*</Label>
          <Input id="scheduled_minutes" name="scheduled_minutes" type="number" min={1} max={1440} defaultValue={480} required />
          <ErrorMsg errors={fieldErrors.scheduled_minutes} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="work_start">始業時刻</Label>
          <Input id="work_start" name="work_start" type="time" />
          <ErrorMsg errors={fieldErrors.work_start} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="work_end">終業時刻</Label>
          <Input id="work_end" name="work_end" type="time" />
          <ErrorMsg errors={fieldErrors.work_end} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="break_minutes">休憩（分）</Label>
          <Input id="break_minutes" name="break_minutes" type="number" min={0} max={1440} defaultValue={0} />
          <ErrorMsg errors={fieldErrors.break_minutes} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? '保存中…' : '追加'}
          </Button>
        </div>
        {formError && <p className="md:col-span-2 text-sm text-destructive">{formError}</p>}
      </form>
    </div>
  )
}
