'use client'

import { useFormState, useFormStatus } from 'react-dom'
import {
  toggleFaceAuthAction,
  updateVoiceSettingAction,
  type FaceAuthToggleState,
  type VoiceSettingState,
} from '@/lib/actions/face'

interface ProfileSettingsClientProps {
  userId: string
  faceAuthEnabled: boolean
  voiceEnabled: boolean | null
  hasFaceData: boolean
  faceRegisteredAt: string | null
}

export function ProfileSettingsClient({
  userId,
  faceAuthEnabled,
  voiceEnabled,
  hasFaceData,
  faceRegisteredAt,
}: ProfileSettingsClientProps) {
  return (
    <div className="space-y-6">
      {/* 顔データ状態 */}
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">顔データ</h3>
        {hasFaceData ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tiffany-100 px-3 py-1 text-tiffany-700 dark:bg-tiffany-900/30 dark:text-tiffany-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-tiffany-500" />
              登録済み
            </span>
            {faceRegisteredAt && (
              <span className="text-gray-500">
                {new Date(faceRegisteredAt).toLocaleDateString('ja-JP')}
              </span>
            )}
            <a
              href="/me/face/setup"
              className="ml-auto text-xs text-tiffany-600 underline hover:text-tiffany-700 dark:text-tiffany-400"
            >
              再登録 →
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">未登録</span>
            <a
              href="/me/face/setup"
              className="ml-auto rounded-lg bg-tiffany-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-tiffany-600"
            >
              顔を登録する →
            </a>
          </div>
        )}
      </div>

      {/* 顔認証 ON/OFF */}
      <FaceAuthToggleSection
        userId={userId}
        current={faceAuthEnabled}
        hasFaceData={hasFaceData}
      />

      {/* 音声読み上げ設定 */}
      <VoiceSettingSection userId={userId} current={voiceEnabled} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 顔認証トグル
// ---------------------------------------------------------------------------
function FaceAuthToggleSection({
  userId,
  current,
  hasFaceData,
}: {
  userId: string
  current: boolean
  hasFaceData: boolean
}) {
  const [state, formAction] = useFormState<FaceAuthToggleState, FormData>(
    toggleFaceAuthAction,
    undefined,
  )

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">顔認証打刻</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {hasFaceData
              ? '/clock/face から顔認証で打刻できます'
              : '顔データを先に登録してください'}
          </p>
          {state?.ok === false && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {state.formError ?? 'エラーが発生しました'}
            </p>
          )}
          {state?.ok === true && (
            <p className="mt-2 text-sm text-tiffany-600 dark:text-tiffany-400">
              {state.message}
            </p>
          )}
        </div>
        <form action={formAction} className="flex-shrink-0">
          <input type="hidden" name="user_id" value={userId} />
          <input
            type="hidden"
            name="face_auth_enabled"
            value={current ? 'false' : 'true'}
          />
          <FaceToggleButton current={current} disabled={!hasFaceData && !current} />
        </form>
      </div>
    </div>
  )
}

function FaceToggleButton({ current, disabled }: { current: boolean; disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={disabled ? '顔データを先に登録してください' : undefined}
      className={[
        'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tiffany-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
        current ? 'bg-tiffany-500' : 'bg-gray-300 dark:bg-gray-600',
      ].join(' ')}
      aria-label={current ? '顔認証を無効にする' : '顔認証を有効にする'}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          current ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/80">
          …
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// 音声読み上げ設定
// ---------------------------------------------------------------------------
function VoiceSettingSection({
  userId,
  current,
}: {
  userId: string
  current: boolean | null
}) {
  const [state, formAction] = useFormState<VoiceSettingState, FormData>(
    updateVoiceSettingAction,
    undefined,
  )

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">音声読み上げ</h3>
      <p className="mb-3 text-xs text-gray-500">
        打刻時に「〇〇さん、出勤しました」と読み上げます
      </p>

      {state?.ok === false && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">
          {state.formError ?? 'エラーが発生しました'}
        </p>
      )}
      {state?.ok === true && (
        <p className="mb-2 text-sm text-tiffany-600 dark:text-tiffany-400">
          {state.message}
        </p>
      )}

      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="user_id" value={userId} />
        <select
          name="voice_announcement_enabled"
          defaultValue={
            current === true ? 'true' : current === false ? 'false' : 'null'
          }
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="null">デフォルト（店舗設定に従う）</option>
          <option value="true">ON（常に読み上げ）</option>
          <option value="false">OFF（読み上げなし）</option>
        </select>
        <VoiceSubmitButton />
      </form>
    </div>
  )
}

function VoiceSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-tiffany-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-tiffany-600 disabled:opacity-50"
    >
      {pending ? '…' : '保存'}
    </button>
  )
}
