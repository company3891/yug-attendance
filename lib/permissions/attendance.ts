import type { UserRole } from '@/lib/database.types'

/**
 * 打刻修正の権限判定（純関数・テスト容易）
 *
 * 可視/操作スコープの統一基準（lib/permissions/scope.ts と同じ考え方）:
 * - employee     : 不可
 * - master       : 全店舗可
 * - 会社(store)  : 自社（company_id 一致）の全事業所の打刻を修正可
 * - 事業所(admin): 自分の事業所（store_id 一致）の打刻のみ修正可
 */
export function canEditAttendance(args: {
  actorRole: UserRole
  actorCompanyId: string | null
  actorStoreId: string | null
  /** 対象打刻が属する店舗の会社ID */
  targetCompanyId: string | null
  /** 対象打刻の店舗ID */
  targetStoreId: string
}): boolean {
  const { actorRole, actorCompanyId, actorStoreId, targetCompanyId, targetStoreId } = args
  if (actorRole === 'employee') return false
  if (actorRole === 'master') return true
  if (actorRole === 'store') return actorCompanyId != null && actorCompanyId === targetCompanyId
  // admin（事業所）: 自分の店舗のみ
  return actorStoreId != null && actorStoreId === targetStoreId
}
