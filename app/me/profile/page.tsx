import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { ProfileSettingsClient } from './profile-settings-client'

export default async function ProfilePage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mx-auto max-w-xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-tiffany-700">個人設定</h1>
            <p className="mt-1 text-sm text-gray-500">顔認証・音声読み上げの設定を変更できます</p>
          </div>

          {/* ユーザー情報 */}
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tiffany-100 text-lg font-semibold text-tiffany-700 dark:bg-tiffany-900/30 dark:text-tiffany-300">
                {me.name.slice(0, 1)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{me.name}</p>
                <p className="text-sm text-gray-500">{me.employee_no ?? ''}</p>
              </div>
            </div>
          </div>

          <ProfileSettingsClient
            userId={me.id}
            faceAuthEnabled={me.face_auth_enabled ?? false}
            voiceEnabled={me.voice_announcement_enabled ?? null}
            hasFaceData={!!me.face_descriptors}
            faceRegisteredAt={me.face_registered_at ?? null}
          />

          {/* ナビゲーション */}
          <div className="flex gap-2 pt-2">
            <a
              href="/me/attendance"
              className="flex-1 rounded-xl border border-gray-300 py-2 text-center text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
            >
              勤怠画面
            </a>
            <a
              href="/dashboard"
              className="flex-1 rounded-xl border border-gray-300 py-2 text-center text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
            >
              ダッシュボード
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
