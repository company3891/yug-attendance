import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { FaceClock } from './face-clock'

export default async function FaceClockPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  // 顔認証が有効でない場合はQRへリダイレクト
  if (!me.face_auth_enabled || !me.face_descriptors) {
    redirect('/clock/qr')
  }

  const admin = createAdminClient()
  const { data: store } = await admin
    .from('stores')
    .select('id, name, voice_announcement_default')
    .eq('id', me.store_id!)
    .single()

  const storeDefault = (store as { voice_announcement_default: boolean } | null)
    ?.voice_announcement_default ?? true

  return (
    <main className="min-h-screen bg-deepgray text-white">
      <FaceClock
        userId={me.id}
        userName={me.name}
        storeId={me.store_id!}
        voiceEnabled={
          me.voice_announcement_enabled !== null && me.voice_announcement_enabled !== undefined
            ? me.voice_announcement_enabled
            : storeDefault
        }
        failCount={me.face_failed_count ?? 0}
      />
    </main>
  )
}
