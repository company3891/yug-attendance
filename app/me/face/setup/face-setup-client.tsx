'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { registerFaceAction, type FaceRegisterState } from '@/lib/actions/face'
import { loadFaceModels, extractDescriptor, descriptorToArray, REQUIRED_DESCRIPTORS, detectorOptionsForRegistration } from '@/lib/faceAuth'

type Step = 'idle' | 'loading_model' | 'camera' | 'captured' | 'registering' | 'done' | 'error'
type CaptureAngle = '正面' | '左45°' | '右45°'
const ANGLES: CaptureAngle[] = ['正面', '左45°', '右45°']

interface FaceSetupClientProps {
  userId: string
  userName: string
  hasExistingDescriptors: boolean
  faceAuthEnabled: boolean
  imageConsent: boolean
  faceRegisteredAt: string | null
}

export function FaceSetupClient({
  userId,
  userName,
  hasExistingDescriptors,
  faceAuthEnabled,
  imageConsent: initialImageConsent,
  faceRegisteredAt,
}: FaceSetupClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [step, setStep] = useState<Step>('idle')
  const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>([])
  const [imageConsentChecked, setImageConsentChecked] = useState(initialImageConsent)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [qualityMsg, setQualityMsg] = useState<string>('カメラを起動してください')
  const [faceDetected, setFaceDetected] = useState(false)
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [state, formAction] = useFormState<FaceRegisterState, FormData>(
    registerFaceAction,
    undefined,
  )

  const currentAngle = ANGLES[capturedDescriptors.length] ?? null
  const allCaptured = capturedDescriptors.length >= REQUIRED_DESCRIPTORS

  // カメラ起動
  const startCamera = useCallback(async () => {
    setStep('loading_model')
    setErrorMsg(null)
    try {
      await loadFaceModels()
    } catch (e) {
      setErrorMsg(`モデル読み込み失敗: ${e instanceof Error ? e.message : String(e)}`)
      setStep('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStep('camera')
    } catch (e) {
      setErrorMsg(`カメラ起動失敗: ${e instanceof Error ? e.message : String(e)}`)
      setStep('error')
    }
  }, [])

  // リアルタイム品質チェック（500ms毎に顔検出）
  useEffect(() => {
    if (step !== 'camera') {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current)
      return
    }
    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      const descriptor = await extractDescriptor(videoRef.current, detectorOptionsForRegistration)
      if (descriptor) {
        setFaceDetected(true)
        setQualityMsg('顔を検出しています — 撮影ボタンを押してください')
      } else {
        setFaceDetected(false)
        setQualityMsg('顔が検出できません — カメラに正面を向けてください')
      }
    }, 500)
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current)
    }
  }, [step])

  // カメラ停止
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  // 1枚撮影
  const capture = useCallback(async () => {
    if (!videoRef.current || !faceDetected) return
    const descriptor = await extractDescriptor(videoRef.current, detectorOptionsForRegistration)
    if (!descriptor) {
      setQualityMsg('顔が検出できませんでした。再試行してください')
      return
    }
    const updated = [...capturedDescriptors, descriptorToArray(descriptor)]
    setCapturedDescriptors(updated)

    if (updated.length >= REQUIRED_DESCRIPTORS) {
      stopCamera()
      setStep('captured')
    } else {
      setQualityMsg(`${updated.length}/${REQUIRED_DESCRIPTORS} 撮影完了 — 次の角度へ`)
    }
  }, [faceDetected, capturedDescriptors, stopCamera])

  // やり直し
  const resetCapture = () => {
    setCapturedDescriptors([])
    setStep('idle')
    setErrorMsg(null)
    setFaceDetected(false)
  }

  // 登録成功後
  useEffect(() => {
    if (state?.ok === true) setStep('done')
  }, [state])

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        顔認証セットアップ
      </h1>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {userName} さん — 3枚の写真から顔特徴を登録します
      </p>

      {/* 既存データの状態 */}
      {hasExistingDescriptors && (
        <div className="mb-4 rounded-xl border border-tiffany-200 bg-tiffany-50 p-3 text-sm dark:border-tiffany-800 dark:bg-tiffany-900/20">
          <span className="font-medium text-tiffany-700 dark:text-tiffany-300">
            顔データ登録済み
          </span>
          {faceRegisteredAt && (
            <span className="ml-2 text-tiffany-600 dark:text-tiffany-400">
              ({new Date(faceRegisteredAt).toLocaleDateString('ja-JP')})
            </span>
          )}
          {faceAuthEnabled && (
            <span className="ml-2 rounded-full bg-tiffany-100 px-2 py-0.5 text-xs font-medium text-tiffany-700 dark:bg-tiffany-900 dark:text-tiffany-300">
              顔認証 ON
            </span>
          )}
        </div>
      )}

      {/* ステップインジケーター */}
      <div className="mb-6 flex gap-2">
        {ANGLES.map((angle, i) => (
          <div
            key={angle}
            className={[
              'flex-1 rounded-xl py-2 text-center text-sm font-medium transition-colors',
              i < capturedDescriptors.length
                ? 'bg-tiffany-500 text-white'
                : i === capturedDescriptors.length && step === 'camera'
                  ? 'bg-tiffany-100 text-tiffany-700 ring-2 ring-tiffany-400 dark:bg-tiffany-900 dark:text-tiffany-300'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800',
            ].join(' ')}
          >
            {i < capturedDescriptors.length ? '✓' : `${i + 1}.`} {angle}
          </div>
        ))}
      </div>

      {/* カメラビュー */}
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={[
            'w-full',
            step !== 'camera' ? 'hidden' : '',
          ].join(' ')}
        />
        {step !== 'camera' && (
          <div className="flex h-64 items-center justify-center">
            {step === 'loading_model' ? (
              <p className="text-sm text-white/60">モデルを読み込み中…</p>
            ) : (
              <p className="text-sm text-white/40">カメラ停止中</p>
            )}
          </div>
        )}

        {/* 顔検出オーバーレイ */}
        {step === 'camera' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className={[
                'h-52 w-40 rounded-full border-4 transition-colors',
                faceDetected ? 'border-tiffany-400/80' : 'border-white/30',
              ].join(' ')}
            />
          </div>
        )}
      </div>

      {/* 品質メッセージ */}
      {step === 'camera' && (
        <p className={[
          'mb-4 text-center text-sm',
          faceDetected ? 'text-tiffany-600 dark:text-tiffany-400' : 'text-gray-500',
        ].join(' ')}>
          {qualityMsg}
        </p>
      )}

      {/* 現在のステップ名 */}
      {step === 'camera' && currentAngle && (
        <p className="mb-4 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          {capturedDescriptors.length + 1}枚目：<span className="text-tiffany-600">{currentAngle}</span>を向いてください
        </p>
      )}

      {/* アクションボタン */}
      <div className="flex flex-col gap-3">
        {step === 'idle' && (
          <button
            onClick={startCamera}
            className="w-full rounded-xl bg-tiffany-500 py-3 text-base font-semibold text-white transition hover:bg-tiffany-600 active:scale-95"
          >
            カメラを起動して登録開始
          </button>
        )}

        {step === 'camera' && (
          <button
            onClick={capture}
            disabled={!faceDetected}
            className={[
              'w-full rounded-xl py-3 text-base font-semibold text-white transition active:scale-95',
              faceDetected
                ? 'bg-tiffany-500 hover:bg-tiffany-600'
                : 'bg-gray-300 cursor-not-allowed dark:bg-gray-700',
            ].join(' ')}
          >
            撮影 ({capturedDescriptors.length + 1}/{REQUIRED_DESCRIPTORS})
          </button>
        )}

        {step === 'captured' && !allCaptured && (
          <p className="text-center text-sm text-gray-500">撮影中…</p>
        )}

        {/* 登録フォーム（3枚撮影完了後） */}
        {(step === 'captured' || step === 'registering') && allCaptured && (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              3枚の撮影完了
            </h3>
            <label className="mb-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={imageConsentChecked}
                onChange={(e) => setImageConsentChecked(e.target.checked)}
                className="mt-1 h-4 w-4 accent-tiffany-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                顔画像をサーバーに保存することに同意する
                （チェックしない場合は特徴ベクトルのみ保存されます）
              </span>
            </label>
            <form action={formAction}>
              <input type="hidden" name="user_id" value={userId} />
              <input
                type="hidden"
                name="descriptors_json"
                value={JSON.stringify(capturedDescriptors)}
              />
              <input
                type="hidden"
                name="image_consent"
                value={imageConsentChecked ? 'true' : 'false'}
              />
              <RegisterSubmitButton />
            </form>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-xl border border-tiffany-200 bg-tiffany-50 p-4 text-center dark:border-tiffany-800 dark:bg-tiffany-900/20">
            <p className="text-base font-semibold text-tiffany-700 dark:text-tiffany-300">
              顔データを登録しました！
            </p>
            <p className="mt-1 text-sm text-tiffany-600 dark:text-tiffany-400">
              管理者が顔認証をONにするか、プロフィールから有効化してください。
            </p>
          </div>
        )}

        {(step === 'camera' || step === 'captured' || step === 'done') && (
          <button
            onClick={resetCapture}
            className="w-full rounded-xl border border-gray-300 py-2 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
          >
            最初からやり直す
          </button>
        )}
      </div>

      {/* エラー表示 */}
      {(errorMsg || (state && !state.ok)) && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {errorMsg ?? (state && !state.ok ? (state.formError ?? 'エラーが発生しました') : '')}
        </div>
      )}

      {/* ナビゲーション */}
      <div className="mt-8 flex gap-2">
        <a
          href="/me/attendance"
          className="flex-1 rounded-xl border border-gray-300 py-2 text-center text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
        >
          勤怠画面へ
        </a>
        <a
          href="/dashboard"
          className="flex-1 rounded-xl border border-gray-300 py-2 text-center text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
        >
          ダッシュボードへ
        </a>
      </div>
    </div>
  )
}

function RegisterSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-tiffany-500 py-3 text-base font-semibold text-white transition hover:bg-tiffany-600 disabled:opacity-50"
    >
      {pending ? '登録中…' : '顔データを登録する'}
    </button>
  )
}
