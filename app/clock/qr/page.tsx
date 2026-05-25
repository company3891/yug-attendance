import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClockReader } from './clock-reader'

type StoreOption = { id: string; name: string }

export default async function ClockQrPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const supabase = createClient()
  // 自分の所属店舗を取得（複数店舗運用可能性を考慮、Phase 2 では自分のstore_idのみ）
  const { data } = await supabase.from('stores').select('id, name')
  const stores = ((data ?? []) as unknown as StoreOption[]).filter(
    (s) => s.id === me.store_id || me.role === 'master',
  )
  const defaultStoreId = me.store_id ?? stores[0]?.id ?? null

  return (
    <main className="min-h-screen bg-deepgray text-white">
      <ClockReader stores={stores} defaultStoreId={defaultStoreId} userName={me.name} />
    </main>
  )
}
