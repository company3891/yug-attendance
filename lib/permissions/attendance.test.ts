import { describe, it, expect } from 'vitest'
import { canEditAttendance } from './attendance'

const C1 = 'company-1'
const C2 = 'company-2'
const SA = 'store-a'
const SB = 'store-b'

describe('canEditAttendance', () => {
  it('employee は不可', () => {
    expect(
      canEditAttendance({
        actorRole: 'employee',
        actorCompanyId: C1,
        actorStoreId: SA,
        targetCompanyId: C1,
        targetStoreId: SA,
      }),
    ).toBe(false)
  })

  it('master は他社でも可', () => {
    expect(
      canEditAttendance({
        actorRole: 'master',
        actorCompanyId: C1,
        actorStoreId: null,
        targetCompanyId: C2,
        targetStoreId: SB,
      }),
    ).toBe(true)
  })

  it('会社(store) は自社の別事業所でも可', () => {
    expect(
      canEditAttendance({
        actorRole: 'store',
        actorCompanyId: C1,
        actorStoreId: SA,
        targetCompanyId: C1,
        targetStoreId: SB, // 同社の別店舗
      }),
    ).toBe(true)
  })

  it('会社(store) は他社は不可', () => {
    expect(
      canEditAttendance({
        actorRole: 'store',
        actorCompanyId: C1,
        actorStoreId: SA,
        targetCompanyId: C2,
        targetStoreId: SB,
      }),
    ).toBe(false)
  })

  it('会社(store) で company_id 未設定は不可', () => {
    expect(
      canEditAttendance({
        actorRole: 'store',
        actorCompanyId: null,
        actorStoreId: SA,
        targetCompanyId: C1,
        targetStoreId: SA,
      }),
    ).toBe(false)
  })

  it('事業所(admin) は自店舗のみ可', () => {
    expect(
      canEditAttendance({
        actorRole: 'admin',
        actorCompanyId: C1,
        actorStoreId: SA,
        targetCompanyId: C1,
        targetStoreId: SA,
      }),
    ).toBe(true)
  })

  it('事業所(admin) は同社でも別店舗は不可', () => {
    expect(
      canEditAttendance({
        actorRole: 'admin',
        actorCompanyId: C1,
        actorStoreId: SA,
        targetCompanyId: C1,
        targetStoreId: SB,
      }),
    ).toBe(false)
  })

  it('事業所(admin) で store_id 未設定は不可', () => {
    expect(
      canEditAttendance({
        actorRole: 'admin',
        actorCompanyId: C1,
        actorStoreId: null,
        targetCompanyId: C1,
        targetStoreId: SA,
      }),
    ).toBe(false)
  })
})
