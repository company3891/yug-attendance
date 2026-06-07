'use client'

import { useFormState, useFormStatus } from 'react-dom'
import {
  toggleFaceAuthAction,
  updateVoiceSettingAction,
  resetFaceAction,
  type FaceAuthToggleState,
  type VoiceSettingState,
  type FaceResetState,
} from '@/lib/actions/face'

interface AuthSettingsClientProps {
  userId: string
  faceAuthEnabled: boolean
  voiceEnabled: boolean | null
  hasFaceData: boolean
  faceRegisteredAt: string | null
  faceFailedCount: number
}

export function AuthSettingsClient({
  userId,
  faceAuthEnabled,
  voiceEnabled,
  hasFaceData,
  faceRegisteredAt,
  faceFailedCount,
}: AuthSettingsClientProps) {
  return (
    <div className="space-y-6">
      {/* 顔データ状態 */}
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">顔データ状態</h3>
        {hasFaceData ? (
          <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-tiffany-500" />
              登録済み
              {faceRegisteredAt && (
                <span className="text-gray-500">
                  ({new Date(faceRegisteredAt).toLocaleDateString('ja-JP')})
                </span>
              )}
            </span>
            {faceFailedCount > 0 && (
              <span className="text-coral-600 dark:text-coral-400">
                認証失敗: {faceFailedCount}回
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">顔データ未登録</p>
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

      {/* 顔データリセット */}
      {hasFaceData && <FaceResetSection userId={userId} />}
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
      <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">顔認証</h3>
      <p className="mb-3 text-xs text-gray-500">顔認証打刻を有効にします（顔データ登録が必要）</p>

      {state?.ok === false && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {state.formError ?? 'エラーが発生しました'}
        </p>
      )}
      {state?.ok === true && (
        <p className="mb-3 rounded-lg bg-tiffany-50 p-2 text-sm text-tiffany-700 dark:bg-tiffany-900/20 dark:text-tiffany-300">
          {state.message}
        </p>
      )}

      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="user_id" value={userId} />
        <input
          type="hidden"
          name="face_auth_enabled"
          value={current ? 'false' : 'true'}
        />
        <span
          className={[
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
            current
              ? 'bg-tiffany-100 text-tiffany-700 dark:bg-tiffany-900/30 dark:text-tiffany-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
          ].join(' ')}
        >
          {current ? 'ON' : 'OFF'}
        </span>
        <FaceAuthToggleButton
          nextState={!current}
          disabled={!hasFaceData && !current}
        />
      </form>
    </div>
  )
}

function FaceAuthToggleButton({
  nextState,
  disabled,
}: {
  nextState: boolean
  disabled: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={disabled ? '顔データを先に登録してください' : undefined}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      {pending ? '更新中…' : nextState ? '有効にする' : '無効にする'}
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

  const displayValue =
    current === true ? 'on' : current === false ? 'off' : 'default'

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">音声読み上げ</h3>
      <p className="mb-3 text-xs text-gray-500">
        打刻時に姓と打刻種別を音声で読み上げます（「デフォルト」は店舗設定に従います）
      </p>

      {state?.ok === false && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {state.formError ?? 'エラーが発生しました'}
        </p>
      )}
      {state?.ok === true && (
        <p className="mb-3 rounded-lg bg-tiffany-50 p-2 text-sm text-tiffany-700 dark:bg-tiffany-900/20 dark:text-tiffany-300">
          {state.message}
        </p>
      )}

      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="user_id" value={userId} />
        <select
          name="voice_announcement_enabled"
          defaultValue={displayValue === 'on' ? 'true' : displayValue === 'off' ? 'false' : 'null'}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="null">デフォルト（店舗設定）</option>
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
      className="rounded-lg bg-tiffany-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-tiffany-600 disabled:opacity-50"
    >
      {pending ? '保存中…' : '保存'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// 顔データリセット
// ---------------------------------------------------------------------------
function FaceResetSection({ userId }: { userId: string }) {
  const [state, formAction] = useFormState<FaceResetState, FormData>(
    resetFaceAction,
    undefined,
  )

  return (
    <div className="rounded-xl border border-red-200 p-4 dark:border-red-800">
      <h3 className="mb-1 font-semibold text-red-700 dark:text-red-400">顔データリセット</h3>
      <p className="mb-3 text-xs text-gray-500">
        登録済みの顔特徴ベクトルと関連設定をすべて削除します。この操作は取り消せません。
      </p>

      {state?.ok === false && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {state.formError ?? 'エラーが発生しました'}
        </p>
      )}
      {state?.ok === true && (
        <p className="mb-3 rounded-lg bg-tiffany-50 p-2 text-sm text-tiffany-700 dark:bg-tiffany-900/20 dark:text-tiffany-300">
          {state.message}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="user_id" value={userId} />
        <FaceResetButton />
      </form>
    </div>
  )
}

function FaceResetButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm('顔データをリセットしますか？この操作は取り消せません。')) {
          e.preventDefault()
        }
      }}
      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
    >
      {pending ? 'リセット中…' : '顔データをリセットする'}
    </button>
  )
}
