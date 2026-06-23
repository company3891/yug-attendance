import { describe, it, expect } from 'vitest'
import {
  canAssignRole,
  authorizeUserAssignment,
  canManageExistingUser,
  type ActorScope,
  type ExistingUserScope,
} from './userManagement'

const C1 = 'company-1'
const C2 = 'company-2'
const S1 = 'store-1'
const S2 = 'store-2'
const D1 = 'dept-1'
const D2 = 'dept-2'

const masterActor: ActorScope = { role: 'master', companyId: C1, storeId: null, departmentId: null }
const storeActor: ActorScope = { role: 'store', companyId: C1, storeId: S1, departmentId: D1 }
const adminActor: ActorScope = { role: 'admin', companyId: C1, storeId: S1, departmentId: D1 }

// ---------------------------------------------------------------------------
// canAssignRole（role 上限：自分より厳密に下位のみ）
// ---------------------------------------------------------------------------
describe('canAssignRole', () => {
  it('master は任意の role を付与可（master も）', () => {
    for (const r of ['master', 'store', 'admin', 'employee'] as const) {
      expect(canAssignRole('master', r)).toBe(true)
    }
  })
  it('store(会社) は admin/employee のみ。store/master は不可', () => {
    expect(canAssignRole('store', 'master')).toBe(false)
    expect(canAssignRole('store', 'store')).toBe(false)
    expect(canAssignRole('store', 'admin')).toBe(true)
    expect(canAssignRole('store', 'employee')).toBe(true)
  })
  it('admin(事業所) は employee のみ', () => {
    expect(canAssignRole('admin', 'master')).toBe(false)
    expect(canAssignRole('admin', 'store')).toBe(false)
    expect(canAssignRole('admin', 'admin')).toBe(false)
    expect(canAssignRole('admin', 'employee')).toBe(true)
  })
  it('employee は何も付与不可', () => {
    expect(canAssignRole('employee', 'employee')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// authorizeUserAssignment（作成 / 編集の新値に対するスコープ強制 + role上限）
// ---------------------------------------------------------------------------
describe('authorizeUserAssignment', () => {
  it('master: 任意の会社・role を passthrough', () => {
    const d = authorizeUserAssignment({
      actor: masterActor,
      requested: { role: 'master', companyId: C2, storeId: S2, departmentId: D2 },
      lookups: {},
    })
    expect(d.ok).toBe(true)
    if (d.ok) {
      expect(d.role).toBe('master')
      expect(d.companyId).toBe(C2)
      expect(d.storeId).toBe(S2)
    }
  })

  it('store: role=store/master は role エラー', () => {
    expect(
      authorizeUserAssignment({
        actor: storeActor,
        requested: { role: 'store', companyId: C1, storeId: null, departmentId: null },
        lookups: {},
      }),
    ).toMatchObject({ ok: false, field: 'role' })
    expect(
      authorizeUserAssignment({
        actor: storeActor,
        requested: { role: 'master', companyId: C1, storeId: null, departmentId: null },
        lookups: {},
      }),
    ).toMatchObject({ ok: false, field: 'role' })
  })

  it('store: 他社 company_id を指定しても自社に上書きされる', () => {
    const d = authorizeUserAssignment({
      actor: storeActor,
      requested: { role: 'employee', companyId: C2, storeId: null, departmentId: null },
      lookups: {},
    })
    expect(d.ok).toBe(true)
    if (d.ok) expect(d.companyId).toBe(C1) // 自社に強制
  })

  it('store: 他社の store_id は store_id エラー', () => {
    const d = authorizeUserAssignment({
      actor: storeActor,
      requested: { role: 'employee', companyId: C1, storeId: S2, departmentId: null },
      lookups: { requestedStoreCompanyId: C2 }, // S2 は別会社所属
    })
    expect(d).toMatchObject({ ok: false, field: 'store_id' })
  })

  it('store: 自社の store_id は OK', () => {
    const d = authorizeUserAssignment({
      actor: storeActor,
      requested: { role: 'admin', companyId: C1, storeId: S2, departmentId: null },
      lookups: { requestedStoreCompanyId: C1 },
    })
    expect(d.ok).toBe(true)
    if (d.ok) {
      expect(d.role).toBe('admin')
      expect(d.storeId).toBe(S2)
      expect(d.companyId).toBe(C1)
    }
  })

  it('store: 他社の department_id は department_id エラー', () => {
    const d = authorizeUserAssignment({
      actor: storeActor,
      requested: { role: 'employee', companyId: C1, storeId: null, departmentId: D2 },
      lookups: { requestedDepartmentCompanyId: C2 },
    })
    expect(d).toMatchObject({ ok: false, field: 'department_id' })
  })

  it('store: company_id 未設定の作成者は form エラー', () => {
    const d = authorizeUserAssignment({
      actor: { role: 'store', companyId: null, storeId: null, departmentId: null },
      requested: { role: 'employee', companyId: C1, storeId: null, departmentId: null },
      lookups: {},
    })
    expect(d).toMatchObject({ ok: false, field: 'form' })
  })

  it('admin: role=admin 以上は role エラー、employee は OK', () => {
    expect(
      authorizeUserAssignment({
        actor: adminActor,
        requested: { role: 'admin', companyId: C1, storeId: S1, departmentId: D1 },
        lookups: {},
      }),
    ).toMatchObject({ ok: false, field: 'role' })

    const ok = authorizeUserAssignment({
      actor: adminActor,
      requested: { role: 'employee', companyId: C2, storeId: S2, departmentId: D2 },
      lookups: {},
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      // company/store/department は作成者の所属に上書き
      expect(ok.companyId).toBe(C1)
      expect(ok.storeId).toBe(S1)
      expect(ok.departmentId).toBe(D1)
    }
  })

  it('admin: department_id 未設定の作成者は form エラー', () => {
    const d = authorizeUserAssignment({
      actor: { role: 'admin', companyId: C1, storeId: S1, departmentId: null },
      requested: { role: 'employee', companyId: C1, storeId: S1, departmentId: null },
      lookups: {},
    })
    expect(d).toMatchObject({ ok: false, field: 'form' })
  })

  it('employee 作成者は拒否', () => {
    const d = authorizeUserAssignment({
      actor: { role: 'employee', companyId: C1, storeId: S1, departmentId: D1 },
      requested: { role: 'employee', companyId: C1, storeId: S1, departmentId: D1 },
      lookups: {},
    })
    expect(d.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canManageExistingUser（編集対象が作成者の管轄内かつ下位か）
// ---------------------------------------------------------------------------
describe('canManageExistingUser', () => {
  const emp = (over: Partial<ExistingUserScope> = {}): ExistingUserScope => ({
    role: 'employee',
    companyId: C1,
    storeId: S1,
    departmentId: D1,
    ...over,
  })

  it('master は誰でも編集可', () => {
    expect(canManageExistingUser({ actor: masterActor, existing: emp({ role: 'master', companyId: C2 }) }).ok).toBe(true)
  })

  it('store: 自社の employee/admin は編集可', () => {
    expect(canManageExistingUser({ actor: storeActor, existing: emp({ role: 'employee' }) }).ok).toBe(true)
    expect(canManageExistingUser({ actor: storeActor, existing: emp({ role: 'admin', storeId: S2, departmentId: D2 }) }).ok).toBe(true)
  })

  it('store: 同格以上(store/master)は編集不可（降格・乗っ取り防止）', () => {
    expect(canManageExistingUser({ actor: storeActor, existing: emp({ role: 'store' }) }).ok).toBe(false)
    expect(canManageExistingUser({ actor: storeActor, existing: emp({ role: 'master' }) }).ok).toBe(false)
  })

  it('store: 他社ユーザーは編集不可', () => {
    expect(canManageExistingUser({ actor: storeActor, existing: emp({ companyId: C2 }) }).ok).toBe(false)
  })

  it('admin: 自事業所(同company/store/department)の employee のみ編集可', () => {
    expect(canManageExistingUser({ actor: adminActor, existing: emp() }).ok).toBe(true)
    expect(canManageExistingUser({ actor: adminActor, existing: emp({ departmentId: D2 }) }).ok).toBe(false)
    expect(canManageExistingUser({ actor: adminActor, existing: emp({ storeId: S2 }) }).ok).toBe(false)
    expect(canManageExistingUser({ actor: adminActor, existing: emp({ companyId: C2 }) }).ok).toBe(false)
  })

  it('admin: 同格以上(admin/store/master)は編集不可', () => {
    expect(canManageExistingUser({ actor: adminActor, existing: emp({ role: 'admin' }) }).ok).toBe(false)
    expect(canManageExistingUser({ actor: adminActor, existing: emp({ role: 'store' }) }).ok).toBe(false)
  })

  it('employee は編集不可', () => {
    expect(
      canManageExistingUser({
        actor: { role: 'employee', companyId: C1, storeId: S1, departmentId: D1 },
        existing: emp(),
      }).ok,
    ).toBe(false)
  })
})
