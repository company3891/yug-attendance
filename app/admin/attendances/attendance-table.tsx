'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dateToJstLocal, formatJstTime, formatWorkDateLabel, minutesToHourMinute } from '@/lib/datetime'
import { anomalyLabel } from '@/lib/i18n/anomaly'
import { updateAttendanceAction, type AttendanceEditState } from './actions'

export interface AttendanceRow {
  id: string
  userName: string
  storeName: string
  workDate: string
  clockIn: string | null
  clockOut: string | null
  breakMinutes: number
  laborMinutes: number | null
  hasAnomaly: boolean
  anomalyCodes: string[]
  canEdit: boolean
}

function ErrorMsg({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return (
    <p role="alert" className="text-xs text-destructive">
      {errors[0]}
    </p>
  )
}

function AnomalyBadges({ codes }: { codes: string[] }) {
  if (!codes || codes.length === 0) return null
  return (
    <span className="inline-flex flex-wrap gap-1">
      {codes.map((c) => (
        <span
          key={c}
          className="rounded-full bg-coral-100 px-2 py-0.5 text-[10px] font-medium text-coral-600"
          style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
        >
          ⚠ {anomalyLabel(c)}
        </span>
      ))}
    </span>
  )
}

/** 打刻修正モーダル */
function EditModal({
  row,
  onClose,
}: {
  row: AttendanceRow
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result: AttendanceEditState = await updateAttendanceAction(row.id, formData)
      if (!result) return
      if (result.ok) {
        onClose()
        router.refresh()
        return
      }
      if (result.formError) setFormError(result.formError)
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-tiffany-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-tiffany-700">打刻の修正</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {row.userName} ／ {formatWorkDateLabel(row.workDate)} ／ {row.storeName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="clock_in">出勤時刻 *</Label>
            <Input
              id="clock_in"
              name="clock_in"
              type="datetime-local"
              required
              defaultValue={row.clockIn ? dateToJstLocal(row.clockIn) : ''}
            />
            <ErrorMsg errors={fieldErrors.clock_in} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clock_out">退勤時刻（未退勤なら空欄）</Label>
            <Input
              id="clock_out"
              name="clock_out"
              type="datetime-local"
              defaultValue={row.clockOut ? dateToJstLocal(row.clockOut) : ''}
            />
            <ErrorMsg errors={fieldErrors.clock_out} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="break_minutes">休憩（分）</Label>
            <Input
              id="break_minutes"
              name="break_minutes"
              type="number"
              min={0}
              defaultValue={row.breakMinutes ?? 0}
            />
            <ErrorMsg errors={fieldErrors.break_minutes} />
          </div>

          {formError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  const [editing, setEditing] = useState<AttendanceRow | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">該当する打刻データがありません。</p>
  }

  return (
    <>
      {/* ▼ デスクトップ: テーブル（md以上） */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">勤務日</th>
              <th className="py-2 pr-4">氏名</th>
              <th className="py-2 pr-4">店舗</th>
              <th className="py-2 pr-4">出勤</th>
              <th className="py-2 pr-4">退勤</th>
              <th className="py-2 pr-4">休憩</th>
              <th className="py-2 pr-4">労働</th>
              <th className="py-2 pr-4">状態</th>
              <th className="py-2 pr-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap">{formatWorkDateLabel(r.workDate)}</td>
                <td className="py-2 pr-4 font-medium">{r.userName}</td>
                <td className="py-2 pr-4">{r.storeName}</td>
                <td className="py-2 pr-4 font-mono">{formatJstTime(r.clockIn) || '－'}</td>
                <td className="py-2 pr-4 font-mono">{formatJstTime(r.clockOut) || '－'}</td>
                <td className="py-2 pr-4 font-mono">{r.breakMinutes}分</td>
                <td className="py-2 pr-4 font-mono">{minutesToHourMinute(r.laborMinutes)}</td>
                <td className="py-2 pr-4">
                  {r.hasAnomaly ? <AnomalyBadges codes={r.anomalyCodes} /> : '－'}
                </td>
                <td className="py-2 pr-4 text-right">
                  {r.canEdit ? (
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      編集
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">権限なし</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ▼ モバイル: カード型リスト（md未満） */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-tiffany-100 p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{formatWorkDateLabel(r.workDate)}</div>
                <div className="text-sm text-muted-foreground">
                  {r.userName} ／ {r.storeName}
                </div>
              </div>
              {r.hasAnomaly && <AnomalyBadges codes={r.anomalyCodes} />}
            </div>
            <dl className="grid grid-cols-[80px_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">出勤</dt>
              <dd className="font-mono">{formatJstTime(r.clockIn) || '－'}</dd>
              <dt className="text-muted-foreground">退勤</dt>
              <dd className="font-mono">{formatJstTime(r.clockOut) || '－'}</dd>
              <dt className="text-muted-foreground">休憩</dt>
              <dd className="font-mono">{r.breakMinutes}分</dd>
              <dt className="text-muted-foreground">労働</dt>
              <dd className="font-mono">{minutesToHourMinute(r.laborMinutes)}</dd>
            </dl>
            <div className="mt-3 flex gap-2">
              {r.canEdit ? (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(r)}>
                  編集
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">権限なし</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
