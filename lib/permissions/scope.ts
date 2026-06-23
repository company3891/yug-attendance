import type { UserRole } from '@/lib/database.types'

/**
 * role 別「見える範囲（可視スコープ）」の判定（純関数・Phase 5 系の統一）
 *
 * あるべき姿（全画面共通の基準）:
 * - master       : 全データ（'all'）
 * - 会社(store)  : 自社（company_id）配下の全事業所・全部門・全従業員（'company'）
 * - 事業所(admin): 自分の事業所(store_id)配下の全部門・全従業員（'store'）
 * - 従業員(employee): 自分のみ（'self'）
 *
 * 各画面・API はこの結果を「どの列で絞るか」に翻訳して使う:
 * - users 系テーブル: company→company_id / store→store_id / self→id
 * - attendances 系   : company→store_id IN(自社の店舗群) / store→store_id / self→user_id
 *
 * これにより「見えてよい範囲」をサーバー側で一元管理し、画面ごとのバラつきを防ぐ。
 */

export interface ScopeActor {
  id: string
  role: UserRole
  company_id: string | null
  store_id: string | null
}

export type VisibleScope =
  | { kind: 'all' }
  | { kind: 'company'; companyId: string }
  | { kind: 'store'; storeId: string }
  | { kind: 'self'; userId: string }
  | { kind: 'none' }

/** kind:'none'（何も見えない）時に「絶対に一致しない」フィルタとして使う番兵UUID */
export const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000'

export function resolveVisibleScope(me: ScopeActor): VisibleScope {
  switch (me.role) {
    case 'master':
      return { kind: 'all' }
    case 'store':
      return me.company_id ? { kind: 'company', companyId: me.company_id } : { kind: 'none' }
    case 'admin':
      return me.store_id ? { kind: 'store', storeId: me.store_id } : { kind: 'none' }
    default:
      return { kind: 'self', userId: me.id }
  }
}
