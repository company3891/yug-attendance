import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClockReader } from './clock-reader'
import { resolveVoiceEnabled, extractLastName } from '@/lib/speech'

type StoreOption = { id: string; name: string; voice_announcement_default: boolean }

export default async function ClockQrPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const supabase = createClient()
  const { data } = await supabase.from('stores').select('id, name, voice_announcement_default')
  const allStores = (data ?? []) as unknown as StoreOption[]
  const stores = allStores.filter(
    (s) => s.id === me.store_id || me.role === 'master',
  )
  const defaultStoreId = me.store_id ?? stores[0]?.id ?? null

  // 音声読み上げ設定
  const myStore = allStores.find((s) => s.id === defaultStoreId)
  const voiceEnabled = resolveVoiceEnabled(
    me.voice_announcement_enabled ?? null,
    myStore?.voice_announcement_default ?? null,
  )
  const lastName = extractLastName(me.name)

  return (
    <main className="min-h-screen bg-deepgray text-white">
      <ClockReader
        stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        defaultStoreId={defaultStoreId}
        userName={me.name}
        voiceEnabled={voiceEnabled}
        lastName={lastName}
      />
    </main>
  )
}
