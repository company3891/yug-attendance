import { describe, it, expect } from 'vitest'
import { resolveDayType, weekdayOf, type DayTypeSettings } from './dayType'

// 2026年の曜日: 6/22(月)..6/28(日)。6/21=日, 6/20=土
const base: DayTypeSettings = {
  scheduledHolidays: [6], // 土
  legalHoliday: 0, // 日
  holidayAs: 'scheduled_holiday',
  isJapanHoliday: false,
}

describe('weekdayOf', () => {
  it('2026-06-21 は日曜(0)', () => expect(weekdayOf('2026-06-21')).toBe(0))
  it('2026-06-20 は土曜(6)', () => expect(weekdayOf('2026-06-20')).toBe(6))
  it('2026-06-23 は火曜(2)', () => expect(weekdayOf('2026-06-23')).toBe(2))
  it('不正形式は throw', () => expect(() => weekdayOf('2026/06/23')).toThrow())
})

describe('resolveDayType', () => {
  it('平日（火）→ workday', () => {
    expect(resolveDayType('2026-06-23', base)).toBe('workday')
  })

  it('所定休日（土）→ scheduled_holiday', () => {
    expect(resolveDayType('2026-06-20', base)).toBe('scheduled_holiday')
  })

  it('法定休日（日）→ legal_holiday', () => {
    expect(resolveDayType('2026-06-21', base)).toBe('legal_holiday')
  })

  it('祝日 × 所定休日扱い（平日の祝日）→ scheduled_holiday', () => {
    // 2026-05-05 こどもの日(火) を祝日として渡す
    expect(resolveDayType('2026-05-05', { ...base, isJapanHoliday: true })).toBe('scheduled_holiday')
  })

  it('祝日 × 営業日扱い → workday', () => {
    expect(
      resolveDayType('2026-05-05', { ...base, isJapanHoliday: true, holidayAs: 'workday' }),
    ).toBe('workday')
  })

  it('法定休日と所定休日が同じ曜日に重なる → 法定優先', () => {
    // 日曜を法定休日かつ所定休日に設定 → legal_holiday を返す
    expect(
      resolveDayType('2026-06-21', { ...base, scheduledHolidays: [0, 6], legalHoliday: 0 }),
    ).toBe('legal_holiday')
  })

  it('祝日でも法定休日の曜日なら legal_holiday が優先', () => {
    // 日曜の祝日 → legal_holiday（holidayAs に関係なく）
    expect(
      resolveDayType('2026-06-21', { ...base, isJapanHoliday: true }),
    ).toBe('legal_holiday')
  })

  it('所定休日が複数曜日（土日）でも判定できる', () => {
    expect(
      resolveDayType('2026-06-20', { ...base, scheduledHolidays: [0, 6], legalHoliday: 3 }),
    ).toBe('scheduled_holiday')
  })
})
