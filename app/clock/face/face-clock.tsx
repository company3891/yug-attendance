'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadFaceModels,
  extractDescriptor,
  compareFaceDescriptors,
  parseStoredDescriptors,
  MAX_FAIL_COUNT,
} from '@/lib/faceAuth'
import { announceClock, extractLastName, type ClockEventType } from '@/lib/speech'

interface FaceClockProps {
  userId: string
  userName: string
  storeId: string
  voiceEnabled: boolean
  failCount: number
}

type Phase =
  | 'loading_model'
  | 'waiting'
  | 'detecting'
  | 'matched'
  | 'failed'
  | 'clocking'
  | 'success'
  | 'error'

const DETECT_INTERVAL_MS = 800
const FAIL_DISPLAY_MS = 2500

export function FaceClock({ userId, userName, storeId, voiceEnabled, failCount: initialFailCount }: FaceClockProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('loading_model')
  const [message, setMessage] = useState('モデルを読み込み中…')
  const [subMessage, setSubMessage] = useState<string | null>(null)
  const [failCount, setFailCount] = useState(initialFailCount)
  const [clockResult, setClockResult] = useState<{
    event: ClockEventType
    labor_minutes: number | null
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const lastName = extractLastName(userName)

  const stopCamera = useCallback(() => {
    if (detectionRef.current) clearInterval(detectionRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  // フォールバック（失敗回数超過）
  const fallbackToQr = useCallback(() => {
    stopCamera()
    router.push('/clock/qr')
  }, [stopCamera, router])

  // 認証成功後の打刻API呼び出し
  const doClock = useCallback(async () => {
    setPhase('clocking')
    setMessage('打刻中…')

    // 登録済みベクトルを取得してサーバー側で比較するのではなく、
    // クライアント比較済みのため直接打刻APIを呼ぶ（auth_method='face'）
    try {
      const res = await fetch('/api/clock/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, store_id: storeId }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        setPhase('error')
        setMessage(json.message ?? '打刻に失敗しました')
        return
      }

      const event = json.event as ClockEventType
      setClockResult({ event, labor_minutes: json.labor_minutes ?? null })
      setPhase('success')

      // カメラを停止（成功画面を表示するため不要）
      stopCamera()

      // PC/Android では自動再生。iOS Safari では非同期後の speak() が無音になるため
      // サイレントに失敗させ、成功画面のボタンで再生させる
      try {
        announceClock(lastName, event, voiceEnabled)
      } catch {
        // iOS Safari: ユーザー操作から切れた非同期コンテキストでは失敗。ボタンで補完。
      }
    } catch (e) {
      setPhase('error')
      setMessage(`通信エラー: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [userId, storeId, lastName, voiceEnabled, stopCamera])

  // 顔認証メインループ
  const startDetection = useCallback(async () => {
    // ユーザーの登録済みベクトルを取得
    let descriptors: number[][] = []
    try {
      const res = await fetch(`/api/users/${userId}/face-descriptors`)
      if (!res.ok) throw new Error('顔データの取得に失敗しました')
      const json = await res.json()
      descriptors = parseStoredDescriptors(json.face_descriptors)
    } catch (e) {
      setPhase('error')
      setMessage(`顔データ取得エラー: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    if (descriptors.length === 0) {
      setPhase('error')
      setMessage('顔データが未登録です')
      return
    }

    setPhase('detecting')
    setMessage('顔を認識しています…')
    setSubMessage('カメラに正面を向けてください')

    detectionRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      const descriptor = await extractDescriptor(videoRef.current)
      if (!descriptor) return

      const matchDistance = compareFaceDescriptors(descriptor, descriptors)
      if (matchDistance !== null) {
        // 認証成功
        clearInterval(detectionRef.current!)
        setPhase('matched')
        await doClock()
      } else {
        // 認証失敗
        const newCount = failCount + 1
        setFailCount(newCount)

        if (newCount >= MAX_FAIL_COUNT) {
          clearInterval(detectionRef.current!)
          setPhase('failed')
          setMessage('認証に失敗しました')
          setSubMessage('QR打刻へ切り替えます…')
          // 失敗カウントをサーバーに反映
          await fetch(`/api/users/${userId}/face-fail`, { method: 'POST' })
          setTimeout(fallbackToQr, FAIL_DISPLAY_MS)
        }
      }
    }, DETECT_INTERVAL_MS)
  }, [userId, failCount, doClock, fallbackToQr])

  // 初期化: モデルロード → カメラ起動 → 顔検出開始
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        await loadFaceModels()
        if (!mounted) return

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setPhase('waiting')
        setMessage('準備完了 — 認識を開始します')
        await startDetection()
      } catch (e) {
        if (mounted) {
          setPhase('error')
          setErrorMsg(`初期化エラー: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    init()
    return () => {
      mounted = false
      stopCamera()
    }
    // startDetection は依存に含めない（初回のみ実行）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 成功画面（iOS Safari 対応: ボタンで音声再生）
  if (phase === 'success' && clockResult) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        {/* 成功インジケーター */}
        <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-tiffany-500 bg-tiffany-500/20">
          <span className="text-6xl text-tiffany-400">✓</span>
        </div>

        {/* 打刻結果テキスト */}
        <div className="text-center">
          <p className="text-2xl font-bold text-tiffany-300">
            {lastName}さん、{eventLabel(clockResult.event)}
          </p>
          {clockResult.labor_minutes !== null && (
            <p className="mt-2 text-sm text-white/70">
              本日の労働時間: {formatMinutes(clockResult.labor_minutes)}
            </p>
          )}
        </div>

        {/* 音声ボタン（iOS Safari 対応: onClick で直接再生） */}
        {voiceEnabled && (
          <button
            onClick={() => announceClock(lastName, clockResult.event, voiceEnabled)}
            className="rounded-xl border border-tiffany-500/50 bg-tiffany-500/20 px-6 py-3 text-base font-medium text-tiffany-300 transition hover:bg-tiffany-500/30 active:scale-95"
          >
            🔊 音声で確認する
          </button>
        )}

        {/* ナビゲーション */}
        <div className="flex gap-3">
          <a
            href="/clock/face"
            className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/10"
          >
            もう一度打刻する
          </a>
          <a
            href="/dashboard"
            className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/10"
          >
            ダッシュボードへ
          </a>
        </div>
      </div>
    )
  }

  // 認証中画面
  const phaseColors: Record<Phase, string> = {
    loading_model: 'text-white/60',
    waiting: 'text-white/80',
    detecting: 'text-tiffany-300',
    matched: 'text-tiffany-400',
    failed: 'text-red-400',
    clocking: 'text-yellow-300',
    success: 'text-tiffany-300',
    error: 'text-red-400',
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-tiffany-400">顔認証打刻</h1>
        <p className="mt-1 text-sm text-white/60">{userName} さん</p>
      </header>

      {/* ステルスカメラ（非表示: 処理用のみ） */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
        aria-hidden="true"
      />

      {/* 認証状態表示 */}
      <div className="flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-tiffany-500/30">
        <div className="text-5xl">
          {phase === 'failed' ? '✗' :
           phase === 'clocking' ? '⏳' :
           phase === 'detecting' ? '👤' : '⋯'}
        </div>
        <div className="mt-2 text-xs text-white/50">
          {failCount > 0 && `失敗 ${failCount}/${MAX_FAIL_COUNT}`}
        </div>
      </div>

      {/* メッセージ */}
      <div className="text-center">
        <p className={`text-lg font-semibold ${phaseColors[phase]}`}>{message}</p>
        {subMessage && <p className="mt-1 text-sm text-white/60">{subMessage}</p>}
      </div>

      {/* エラー */}
      {(errorMsg || phase === 'error') && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-400">{errorMsg ?? message}</p>
          <button
            onClick={fallbackToQr}
            className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30"
          >
            QR打刻へ切り替え
          </button>
        </div>
      )}

      {/* フッターナビ */}
      <div className="flex gap-3">
        <a
          href="/clock/qr"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
        >
          QR打刻へ
        </a>
        <a
          href="/dashboard"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
        >
          ダッシュボード
        </a>
      </div>
    </div>
  )
}

function eventLabel(event: ClockEventType): string {
  const labels: Record<ClockEventType, string> = {
    clock_in: '出勤しました',
    clock_out: '退勤しました',
    break_start: '休憩を開始しました',
    break_end: '休憩を終了しました',
  }
  return labels[event]
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}時間${String(m).padStart(2, '0')}分`
}
