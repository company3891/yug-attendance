/**
 * GET /api/users/[id]/face-descriptors
 *
 * 本人のみ自分の顔特徴ベクトルを取得できる。
 * クライアント側の顔比較（face-clock.tsx）で使用。
 */

import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const { data, error } = await admin
    .from('users')
    .select('face_descriptors')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, message: 'ユーザーが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, face_descriptors: (data as { face_descriptors: unknown }).face_descriptors })
}
