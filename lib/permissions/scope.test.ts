import { describe, it, expect } from 'vitest'
import { resolveVisibleScope, type ScopeActor } from './scope'

const actor = (over: Partial<ScopeActor>): ScopeActor => ({
  id: 'u1',
  role: 'employee',
  company_id: 'c1',
  store_id: 's1',
  ...over,
})

describe('resolveVisibleScope', () => {
  it('master → 全データ', () => {
    expect(resolveVisibleScope(actor({ role: 'master' }))).toEqual({ kind: 'all' })
  })

  it('会社(store) → 自社の全データ', () => {
    expect(resolveVisibleScope(actor({ role: 'store', company_id: 'c1' }))).toEqual({
      kind: 'company',
      companyId: 'c1',
    })
  })

  it('会社(store) で company_id 未設定 → none（何も見えない）', () => {
    expect(resolveVisibleScope(actor({ role: 'store', company_id: null }))).toEqual({ kind: 'none' })
  })

  it('事業所(admin) → 自分の事業所(store_id)配下全体', () => {
    expect(resolveVisibleScope(actor({ role: 'admin', store_id: 's9' }))).toEqual({
      kind: 'store',
      storeId: 's9',
    })
  })

  it('事業所(admin) で store_id 未設定 → none', () => {
    expect(resolveVisibleScope(actor({ role: 'admin', store_id: null }))).toEqual({ kind: 'none' })
  })

  it('従業員(employee) → 自分のみ', () => {
    expect(resolveVisibleScope(actor({ role: 'employee', id: 'me' }))).toEqual({
      kind: 'self',
      userId: 'me',
    })
  })
})
