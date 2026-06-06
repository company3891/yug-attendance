/**
 * POST /api/users/[id]/face-fail
 *
 * 顔認証失敗カウントをインクリメントする。
 * クライアント側の認証失敗時（face-clock.tsx）から呼ばれる。
 */

import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ ok: false, message: '未ログイン' }, { status: 401 })
  }
  if (authUser.id !== id) {
    return NextResponse.json({ ok: false, message: '権限がありません' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('users')
    .select('face_failed_count')
    .eq('id', id)
    .single()

  const newCount = ((current as { face_failed_count: number } | null)?.face_failed_count ?? 0) + 1

  const { error } = await admin
    .from('users')
    .update({
      face_failed_count: newCount,
      face_last_failed_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fail_count: newCount })
}
