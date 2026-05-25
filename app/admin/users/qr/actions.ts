'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { actionFail, actionOk, type ActionState } from '@/lib/forms/parse'

/**
 * QR を再発行する。
 *
 * - users.qr_version を +1（旧 QR を即時失効）
 * - users.qr_issued_at を now() に更新
 * - 既存の qr_revoked_at をクリア（無効化が再開される運用）
 * - audit_logs に user.qr_reissue として記録（QR失効は監査必須）
 */
export async function reissueQrAction(userId: string): Promise<ActionState> {
  const me = await requireRole('admin')
  const admin = createAdminClient()

  // 現在の qr_version を取得
  const { data: current, error: selErr } = await admin
    .from('users')
    .select('id, qr_version, qr_issued_at, qr_revoked_at')
    .eq('id', userId)
    .single()
  if (selErr || !current) return actionFail('対象の従業員が見つかりません')

  const cur = current as {
    id: string
    qr_version: number
    qr_issued_at: string | null
    qr_revoked_at: string | null
  }
  const newVersion = cur.qr_version + 1
  const now = new Date().toISOString()

  const { error: updErr } = await admin
    .from('users')
    .update({
      qr_version: newVersion,
      qr_issued_at: now,
      qr_revoked_at: null,
      qr_revoked_by: null,
      qr_revoke_reason: null,
    } as never)
    .eq('id', userId)
  if (updErr) return actionFail(updErr.message)

  // 監査ログ
  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'user.qr_reissue',
    resource_type: 'users',
    resource_id: userId,
    before_data: {
      qr_version: cur.qr_version,
      qr_issued_at: cur.qr_issued_at,
      qr_revoked_at: cur.qr_revoked_at,
    },
    after_data: { qr_version: newVersion, qr_issued_at: now, qr_revoked_at: null },
  } as never)

  revalidatePath('/admin/users/qr')
  return actionOk('QRを再発行しました')
}

/**
 * QR を失効させる（再発行はしない、無効化のみ）。
 */
export async function revokeQrAction(
  userId: string,
  reason: string | null = null,
): Promise<ActionState> {
  const me = await requireRole('admin')
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('users')
    .select('qr_version, qr_revoked_at')
    .eq('id', userId)
    .single()
  const cur = current as { qr_version: number; qr_revoked_at: string | null } | null
  if (!cur) return actionFail('対象の従業員が見つかりません')

  const now = new Date().toISOString()
  const { error } = await admin
    .from('users')
    .update({
      qr_revoked_at: now,
      qr_revoked_by: me.id,
      qr_revoke_reason: reason,
    } as never)
    .eq('id', userId)
  if (error) return actionFail(error.message)

  await admin.from('audit_logs').insert({
    actor_id: me.id,
    action: 'user.qr_revoke',
    resource_type: 'users',
    resource_id: userId,
    before_data: { qr_revoked_at: cur.qr_revoked_at },
    after_data: { qr_revoked_at: now, reason },
  } as never)

  revalidatePath('/admin/users/qr')
  return actionOk('QRを失効させました')
}
