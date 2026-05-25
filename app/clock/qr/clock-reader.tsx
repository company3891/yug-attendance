'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

type ToastKind = 'success' | 'error' | 'info'

interface ToastState {
  kind: ToastKind
  title: string
  body?: string
}

interface ClockReaderProps {
  stores: { id: string; name: string }[]
  defaultStoreId: string | null
  userName: string
}

const READER_ID = 'qr-reader-region'
const COOLDOWN_MS = 2_500 // スキャン成功後の再読取クールダウン
const REGION_PX = 320

/**
 * QR 打刻読取画面（タブレット横向き想定）。
 *
 * - html5-qrcode で背面カメラを優先起動
 * - スキャン成功 → POST /api/clock → 結果トーストを 3 秒表示 → 自動でスキャン再開
 * - 端末紐付け店舗 (store_id) はユーザーの所属店舗 既定。master のみ手動切替可。
 */
export function ClockReader({ stores, defaultStoreId, userName }: ClockReaderProps) {
  const [storeId, setStoreId] = useState(defaultStoreId ?? '')
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastDetectAtRef = useRef<number>(0)
  const submittingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!storeId) return
    let active = true
    const scanner = new Html5Qrcode(READER_ID)
    scannerRef.current = scanner

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: REGION_PX },
          async (decodedText) => {
            if (!active) return
            const now = Date.now()
            if (submittingRef.current) return
            if (now - lastDetectAtRef.current < COOLDOWN_MS) return
            lastDetectAtRef.current = now
            submittingRef.current = true
            await handleScan(decodedText)
            // クールダウン解除
            setTimeout(() => {
              submittingRef.current = false
            }, COOLDOWN_MS)
          },
          () => {
            // フレームエラーは無視（多発するため）
          },
        )
        if (active) setRunning(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`カメラ起動に失敗しました: ${msg}`)
      }
    }
    start()

    return () => {
      active = false
      scanner
        .stop()
        .catch(() => {})
        .finally(() => {
          scanner.clear()
          scannerRef.current = null
        })
    }
    // handleScan は storeId 経由でしか変化しない（クロージャで storeId を参照）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  async function handleScan(token: string) {
    setToast({ kind: 'info', title: '打刻中...', body: token.slice(0, 24) + '…' })
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, method: 'qr', store_id: storeId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setToast({
          kind: 'error',
          title: codeLabel(json.code) ?? '打刻失敗',
          body: json.message ?? `HTTP ${res.status}`,
        })
      } else {
        setToast({
          kind: 'success',
          title: json.event === 'clock_in' ? '出勤を記録しました' : '退勤を記録しました',
          body:
            json.event === 'clock_out' && typeof json.labor_minutes === 'number'
              ? `本日の労働時間: ${formatMinutes(json.labor_minutes)}`
              : `勤務日: ${json.work_date}`,
        })
      }
    } catch (e) {
      setToast({
        kind: 'error',
        title: '通信エラー',
        body: e instanceof Error ? e.message : String(e),
      })
    }
    // トーストを 3 秒で自動消去
    setTimeout(() => setToast(null), 3000)
  }

  if (!stores.length) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-lg text-coral">
          打刻可能な店舗が登録されていません。管理者にご連絡ください。
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <header className="w-full max-w-4xl text-center">
        <h1 className="text-3xl font-bold text-tiffany-400 sm:text-4xl">YUG Attendance / 打刻</h1>
        <p className="mt-2 text-sm text-white/70">
          QRコードをカメラにかざしてください — {userName} さん
        </p>
      </header>

      {stores.length > 1 && (
        <div className="w-full max-w-md">
          <Select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="border-white/30 bg-deepgray text-white"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div
        id={READER_ID}
        className="overflow-hidden rounded-2xl bg-black"
        style={{ width: REGION_PX + 32, height: REGION_PX + 32, maxWidth: '90vw' }}
      />

      {error && (
        <div className="max-w-md rounded-lg border border-coral/40 bg-coral/10 p-3 text-sm text-coral">
          {error}
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={
            'fixed bottom-6 left-1/2 w-[90vw] max-w-md -translate-x-1/2 rounded-xl border p-4 shadow-2xl backdrop-blur-md ' +
            (toast.kind === 'success'
              ? 'border-tiffany-500/50 bg-tiffany-500/20 text-white'
              : toast.kind === 'error'
                ? 'border-coral/60 bg-coral/20 text-white'
                : 'border-white/30 bg-white/10 text-white')
          }
        >
          <div className="text-lg font-semibold">{toast.title}</div>
          {toast.body && <div className="text-sm opacity-90">{toast.body}</div>}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            scannerRef.current?.stop().catch(() => {})
            setRunning(false)
          }}
          className="border-white/30 bg-transparent text-white hover:bg-white/10"
        >
          スキャン停止
        </Button>
        <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
          <a href="/dashboard">ダッシュボードへ</a>
        </Button>
      </div>

      <p className="text-xs text-white/40">
        {running ? '読み取り中…' : 'カメラ準備中…'} / クールダウン {COOLDOWN_MS / 1000}秒
      </p>
    </div>
  )
}

function codeLabel(code?: string): string | null {
  if (!code) return null
  const labels: Record<string, string> = {
    CLOCK_TOO_FREQUENT: '連続打刻',
    CLOCK_ALREADY_CLOSED: '本日打刻済み',
    QR_INVALID_FORMAT: 'QR形式エラー',
    QR_INVALID_SIGNATURE: 'QR署名エラー',
    QR_REVOKED: 'QR失効',
    QR_VERSION_MISMATCH: '古いQR',
    USER_INACTIVE: 'アカウント無効',
    STORE_MISMATCH: '別店舗QR',
    FORBIDDEN: '権限エラー',
    UNAUTHORIZED: '未ログイン',
    USER_NOT_FOUND: 'ユーザー不在',
    VALIDATION_FAILED: '入力不正',
    CLOCK_OUT_BEFORE_IN: '時刻整合性エラー',
    INTERNAL_ERROR: '内部エラー',
  }
  return labels[code] ?? code
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}時間${String(m).padStart(2, '0')}分`
}
