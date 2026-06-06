'use client'

import { useActionState, useEffect, useRef } from 'react'
import { buttonClockAction, type ButtonClockState, type ButtonClockResult } from '@/lib/actions/face'
import { announceClock } from '@/lib/speech'
import type { ClockEventType } from '@/lib/speech'

type ClockStatus = 'off' | 'working' | 'on_break'

interface ButtonClockPanelProps {
  currentStatus: ClockStatus
}

// 状態に応じてボタンの活性/非活性を決める
function isEnabled(event: ClockEventType, status: ClockStatus): boolean {
  if (event === 'clock_in') return status === 'off'
  if (event === 'clock_out') return status === 'working'
  if (event === 'break_start') return status === 'working'
  if (event === 'break_end') return status === 'on_break'
  return false
}

const BUTTON_CONFIG: Array<{ event: ClockEventType; label: string; icon: string; color: string }> = [
  { event: 'clock_in',    label: '出勤',    icon: '🟢', color: 'bg-green-500 hover:bg-green-600' },
  { event: 'clock_out',   label: '退勤',    icon: '🔴', color: 'bg-red-500 hover:bg-red-600' },
  { event: 'break_start', label: '休憩',    icon: '⏸',  color: 'bg-yellow-500 hover:bg-yellow-600' },
  { event: 'break_end',   label: '休憩終了', icon: '▶', color: 'bg-blue-500 hover:bg-blue-600' },
]

const STATUS_LABELS: Record<ClockStatus, string> = {
  off: '退勤中',
  working: '勤務中',
  on_break: '休憩中',
}

export function ButtonClockPanel({ currentStatus }: ButtonClockPanelProps) {
  const [state, formAction, isPending] = useActionState<ButtonClockState, FormData>(
    buttonClockAction,
    undefined,
  )
  const confirmRef = useRef<HTMLDialogElement>(null)
  const pendingEventRef = useRef<ClockEventType | null>(null)
  const hiddenFormRef = useRef<HTMLFormElement>(null)

  // 打刻成功時の音声読み上げ
  useEffect(() => {
    if (!state || !state.ok) return
    const result = state as ButtonClockResult & { ok: true }
    if (result.voice?.enabled && result.voice?.lastName && result.event) {
      announceClock(result.voice.lastName, result.event, result.voice.enabled)
    }
  }, [state])

  const handleButtonClick = (event: ClockEventType) => {
    pendingEventRef.current = event
    confirmRef.current?.showModal()
  }

  const handleConfirm = () => {
    confirmRef.current?.close()
    if (!pendingEventRef.current || !hiddenFormRef.current) return
    const fd = new FormData(hiddenFormRef.current)
    fd.set('event_type', pendingEventRef.current)
    formAction(fd)
    pendingEventRef.current = null
  }

  const handleCancel = () => {
    confirmRef.current?.close()
    pendingEventRef.current = null
  }

  const successState = state?.ok ? (state as ButtonClockResult & { ok: true }) : null
  const errorState = state && !state.ok ? state : null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">ボタン打刻</h2>
        <span className={[
          'rounded-full px-3 py-1 text-xs font-medium',
          currentStatus === 'working'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : currentStatus === 'on_break'
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        ].join(' ')}>
          {STATUS_LABELS[currentStatus]}
        </span>
      </div>

      {/* 上段: 出勤 / 退勤 */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        {BUTTON_CONFIG.slice(0, 2).map(({ event, label, icon, color }) => {
          const enabled = isEnabled(event, currentStatus)
          return (
            <button
              key={event}
              onClick={() => handleButtonClick(event)}
              disabled={!enabled || isPending}
              className={[
                'flex min-h-[44px] items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition active:scale-95',
                enabled && !isPending ? color : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600',
              ].join(' ')}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* 下段: 休憩 / 休憩終了 */}
      <div className="grid grid-cols-2 gap-2">
        {BUTTON_CONFIG.slice(2, 4).map(({ event, label, icon, color }) => {
          const enabled = isEnabled(event, currentStatus)
          return (
            <button
              key={event}
              onClick={() => handleButtonClick(event)}
              disabled={!enabled || isPending}
              className={[
                'flex min-h-[44px] items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition active:scale-95',
                enabled && !isPending ? color : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600',
              ].join(' ')}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* 成功メッセージ */}
      {successState && (
        <div className="mt-3 rounded-lg bg-tiffany-50 px-3 py-2 text-sm text-tiffany-700 dark:bg-tiffany-900/20 dark:text-tiffany-300">
          ✓{' '}
          {successState.event === 'clock_in' ? '出勤しました' :
           successState.event === 'clock_out' ? '退勤しました' :
           successState.event === 'break_start' ? '休憩を開始しました' : '休憩を終了しました'}
          {successState.labor_minutes !== null && (
            <span className="ml-2 text-tiffany-600">
              ({formatMinutes(successState.labor_minutes)})
            </span>
          )}
        </div>
      )}

      {/* エラーメッセージ */}
      {errorState && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {errorState.formError ?? 'エラーが発生しました'}
        </div>
      )}

      {/* 処理中インジケーター */}
      {isPending && (
        <div className="mt-3 text-center text-xs text-muted-foreground">打刻中…</div>
      )}

      {/* 隠しフォーム（useActionState に FormData を渡すため） */}
      <form ref={hiddenFormRef} action={formAction} className="hidden">
        <input type="hidden" name="event_type" value="" />
      </form>

      {/* 確認ダイアログ */}
      <dialog
        ref={confirmRef}
        className="rounded-2xl border border-border bg-background p-6 shadow-xl backdrop:bg-black/50"
        onClose={handleCancel}
      >
        <h3 className="mb-2 text-base font-semibold text-foreground">
          {pendingEventRef.current
            ? BUTTON_CONFIG.find((b) => b.event === pendingEventRef.current)?.label
            : ''}
          を記録します
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">よろしいですか？</p>
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 rounded-xl border border-border py-2 text-sm text-foreground hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-tiffany-500 py-2 text-sm font-semibold text-white hover:bg-tiffany-600"
          >
            記録する
          </button>
        </div>
      </dialog>
    </div>
  )
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${String(m).padStart(2, '0')}m`
}
