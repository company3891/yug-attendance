import type { UserRole } from '@/lib/database.types'

/**
 * 打刻修正の権限判定（純関数・テスト容易）
 *
 * - employee は不可
 * - admin / store は自店舗のみ（actorStoreId === targetStoreId）
 * - master は全店舗可
 */
export function canEditAttendance(args: {
  actorRole: UserRole
  actorStoreId: string | null
  targetStoreId: string
}): boolean {
  const { actorRole, actorStoreId, targetStoreId } = args
  if (actorRole === 'employee') return false
  if (actorRole === 'master') return true
  // admin / store: 自店舗のみ
  return actorStoreId != null && actorStoreId === targetStoreId
}
