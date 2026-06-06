/**
 * POST /api/users/[id]/face-reset
 *
 * 顔データをリセット（管理者専用）。
 * 特徴ベクトル・画像・失敗カウントをすべてクリアする。
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

  const admin = createAdminClient()

  // 操作者のロール確認
  const { data: actor } = await admin
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single()

  const isAdmin =
    authUser.id === id ||
    ['master', 'store', 'admin'].includes((actor as { role: string } | null)?.role ?? '')

  if (!isAdmin) {
    return NextResponse.json({ ok: false, message: '権限がありません' }, { status: 403 })
  }

  // Storage の顔画像を削除
  const { data: fileList } = await admin.storage.from('face-images').list(id)
  if (fileList && fileList.length > 0) {
    const paths = fileList.map((f) => `${id}/${f.name}`)
    await admin.storage.from('face-images').remove(paths)
  }

  const { error } = await admin
    .from('users')
    .update({
      face_descriptors: null,
      face_auth_enabled: false,
      face_image_consent: false,
      face_registered_at: null,
      face_failed_count: 0,
      face_last_failed_at: null,
    } as never)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  // 監査ログ
  await admin.from('audit_logs').insert({
    actor_id: authUser.id,
    action: 'face.reset',
    resource_type: 'users',
    resource_id: id,
    auth_method: 'face_reset',
  } as never)

  return NextResponse.json({ ok: true, message: '顔データをリセットしました' })
}
