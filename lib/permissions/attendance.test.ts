import { describe, it, expect } from 'vitest'
import { canEditAttendance } from './attendance'

const STORE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const STORE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

describe('canEditAttendance', () => {
  it('employee はどの店舗でも不可', () => {
    expect(
      canEditAttendance({ actorRole: 'employee', actorStoreId: STORE_A, targetStoreId: STORE_A }),
    ).toBe(false)
  })

  it('master は他店舗でも可', () => {
    expect(
      canEditAttendance({ actorRole: 'master', actorStoreId: STORE_A, targetStoreId: STORE_B }),
    ).toBe(true)
  })

  it('master は store_id が null でも可', () => {
    expect(
      canEditAttendance({ actorRole: 'master', actorStoreId: null, targetStoreId: STORE_B }),
    ).toBe(true)
  })

  it('admin は自店舗のみ可', () => {
    expect(
      canEditAttendance({ actorRole: 'admin', actorStoreId: STORE_A, targetStoreId: STORE_A }),
    ).toBe(true)
    expect(
      canEditAttendance({ actorRole: 'admin', actorStoreId: STORE_A, targetStoreId: STORE_B }),
    ).toBe(false)
  })

  it('store は自店舗のみ可', () => {
    expect(
      canEditAttendance({ actorRole: 'store', actorStoreId: STORE_B, targetStoreId: STORE_B }),
    ).toBe(true)
    expect(
      canEditAttendance({ actorRole: 'store', actorStoreId: STORE_B, targetStoreId: STORE_A }),
    ).toBe(false)
  })

  it('store_id が null の admin/store は不可（紐付け無し）', () => {
    expect(
      canEditAttendance({ actorRole: 'admin', actorStoreId: null, targetStoreId: STORE_A }),
    ).toBe(false)
  })
})
