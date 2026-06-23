import { roleSatisfies } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/database.types'

/**
 * アカウント作成・編集のサーバー側権限判定（純関数・DBアクセスなし）
 *
 * 目的: createUserAction / updateUserAction が service role（RLSバイパス）経由でも、
 * 「所属スコープ」と「role上限」をサーバーで明示的に強制できるようにする。
 *
 * 基準（master以外は自分の管轄内・自分より下位のみ）:
 * - master      : 無制約
 * - store(会社) : 自社(company_id)配下のみ。付与roleは admin/employee。
 * - admin(事業所): 自分の company/store/department 配下のみ。付与roleは employee。
 * - employee    : 不可
 */

export interface ActorScope {
  role: UserRole
  companyId: string | null
  storeId: string | null
  departmentId: string | null
}

export interface RequestedAssignment {
  role: UserRole
  companyId: string | null
  storeId: string | null
  departmentId: string | null
}

/** store作成者が他社の店舗/部門を指定していないか検証するための引き当て結果 */
export interface AssignmentLookups {
  /** requested.storeId が属する会社ID（storeId 指定時のみ意味を持つ） */
  requestedStoreCompanyId?: string | null
  /** requested.departmentId が属する会社ID（departmentId 指定時のみ） */
  requestedDepartmentCompanyId?: string | null
}

export type AssignmentField = 'role' | 'company_id' | 'store_id' | 'department_id' | 'form'

export type AssignmentDecision =
  | { ok: true; role: UserRole; companyId: string | null; storeId: string | null; departmentId: string | null }
  | { ok: false; field: AssignmentField; message: string }

export interface ExistingUserScope {
  role: UserRole
  companyId: string | null
  storeId: string | null
  departmentId: string | null
}

export type ManageDecision = { ok: true } | { ok: false; message: string }

/**
 * actor が target role を付与できるか（自分より厳密に下位のみ。master は無制約）。
 */
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'master') return true
  // roleSatisfies(target, actor) = target が actor 以上 → それを否定（厳密に下位のみ許可）
  return !roleSatisfies(targetRole, actorRole)
}

/**
 * 作成 / 編集の「新しい割り当て」に対する role上限 + 所属スコープ強制。
 * master は passthrough、store は company を自社に上書き＋店舗/部門の所属検証、
 * admin は company/store/department を作成者の所属に上書き。
 */
export function authorizeUserAssignment(input: {
  actor: ActorScope
  requested: RequestedAssignment
  lookups: AssignmentLookups
}): AssignmentDecision {
  const { actor, requested, lookups } = input

  // 1) role 上限（全 role 共通の最初の関門）
  if (!canAssignRole(actor.role, requested.role)) {
    return { ok: false, field: 'role', message: '自分より上位または同格の権限は付与できません' }
  }

  // 2) 所属スコープ
  if (actor.role === 'master') {
    return {
      ok: true,
      role: requested.role,
      companyId: requested.companyId,
      storeId: requested.storeId,
      departmentId: requested.departmentId,
    }
  }

  if (actor.role === 'store') {
    if (!actor.companyId) {
      return { ok: false, field: 'form', message: '操作者に会社が設定されていません' }
    }
    if (requested.storeId && lookups.requestedStoreCompanyId !== actor.companyId) {
      return { ok: false, field: 'store_id', message: '自社の店舗を選択してください' }
    }
    if (requested.departmentId && lookups.requestedDepartmentCompanyId !== actor.companyId) {
      return { ok: false, field: 'department_id', message: '自社の部門を選択してください' }
    }
    return {
      ok: true,
      role: requested.role,
      companyId: actor.companyId, // 自社に強制
      storeId: requested.storeId ?? null,
      departmentId: requested.departmentId ?? null,
    }
  }

  if (actor.role === 'admin') {
    if (!actor.companyId || !actor.departmentId) {
      return { ok: false, field: 'form', message: '操作者の事業所（部門）が設定されていません' }
    }
    return {
      ok: true,
      role: requested.role,
      companyId: actor.companyId, // 自事業所に強制
      storeId: actor.storeId ?? null,
      departmentId: actor.departmentId,
    }
  }

  return { ok: false, field: 'form', message: '権限がありません' }
}

/**
 * 編集時：actor が既存ユーザー existing を編集できるか
 * （管轄内 かつ existing が actor より厳密に下位であること）。
 * これにより「同格以上のユーザーを降格・乗っ取り」「他社/他事業所ユーザーの掌握」を防ぐ。
 */
export function canManageExistingUser(input: {
  actor: ActorScope
  existing: ExistingUserScope
}): ManageDecision {
  const { actor, existing } = input

  if (actor.role === 'master') return { ok: true }

  // 同格以上は編集不可
  if (roleSatisfies(existing.role, actor.role)) {
    return { ok: false, message: '同格以上の権限のユーザーは編集できません' }
  }

  if (actor.role === 'store') {
    if (!actor.companyId) return { ok: false, message: '操作者に会社が設定されていません' }
    if (existing.companyId !== actor.companyId) {
      return { ok: false, message: '自社のユーザーのみ編集できます' }
    }
    return { ok: true }
  }

  if (actor.role === 'admin') {
    if (!actor.companyId || !actor.departmentId) {
      return { ok: false, message: '操作者の事業所（部門）が設定されていません' }
    }
    if (
      existing.companyId !== actor.companyId ||
      existing.storeId !== actor.storeId ||
      existing.departmentId !== actor.departmentId
    ) {
      return { ok: false, message: '自分の事業所のユーザーのみ編集できます' }
    }
    return { ok: true }
  }

  return { ok: false, message: '権限がありません' }
}
