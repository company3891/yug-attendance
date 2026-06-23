import { describe, it, expect } from 'vitest'
import {
  jstLocalToDate,
  dateToJstLocal,
  formatJstDateTime,
  formatJstTime,
  formatJstDate,
  formatWorkDateLabel,
  isWeekend,
  minutesToHourMinute,
} from './datetime'

// vitest は TZ=Asia/Tokyo で実行される想定だが、これらの関数は TZ 非依存であること。

describe('jstLocalToDate', () => {
  it('JST 09:00 を UTC 00:00 に変換する', () => {
    const d = jstLocalToDate('2026-06-23T09:00')
    expect(d.toISOString()).toBe('2026-06-23T00:00:00.000Z')
  })

  it('JST 00:30 を前日 UTC 15:30 に変換する（日付またぎ繰り下がり）', () => {
    const d = jstLocalToDate('2026-06-23T00:30')
    expect(d.toISOString()).toBe('2026-06-22T15:30:00.000Z')
  })

  it('秒付きも受け付ける', () => {
    const d = jstLocalToDate('2026-06-23T09:00:45')
    expect(d.toISOString()).toBe('2026-06-23T00:00:45.000Z')
  })

  it('不正な文字列は throw', () => {
    expect(() => jstLocalToDate('2026/06/23 09:00')).toThrow()
  })
})

describe('dateToJstLocal（round-trip）', () => {
  it('UTC 00:00 → JST datetime-local "2026-06-23T09:00"', () => {
    expect(dateToJstLocal('2026-06-23T00:00:00.000Z')).toBe('2026-06-23T09:00')
  })

  it('jstLocalToDate と相互変換が一致する', () => {
    const local = '2026-12-31T23:45'
    expect(dateToJstLocal(jstLocalToDate(local))).toBe(local)
  })
})

describe('formatJst* 表示', () => {
  it('formatJstDateTime', () => {
    expect(formatJstDateTime('2026-06-23T00:00:00.000Z')).toBe('2026-06-23 09:00')
  })
  it('formatJstTime', () => {
    expect(formatJstTime('2026-06-23T13:05:00.000Z')).toBe('22:05')
  })
  it('formatJstDate（UTC15:00 は翌日 JST 00:00）', () => {
    expect(formatJstDate('2026-06-22T15:00:00.000Z')).toBe('2026-06-23')
  })
  it('null/undefined は空文字', () => {
    expect(formatJstDateTime(null)).toBe('')
    expect(formatJstTime(undefined)).toBe('')
  })
})

describe('work_date ラベル / 土日判定', () => {
  it('2026-06-23（火）', () => {
    expect(formatWorkDateLabel('2026-06-23')).toBe('6/23（火）')
  })
  it('2026-06-21 は日曜', () => {
    expect(formatWorkDateLabel('2026-06-21')).toBe('6/21（日）')
    expect(isWeekend('2026-06-21')).toBe(true)
  })
  it('2026-06-20 は土曜', () => {
    expect(isWeekend('2026-06-20')).toBe(true)
  })
  it('2026-06-23（火）は平日', () => {
    expect(isWeekend('2026-06-23')).toBe(false)
  })
})

describe('minutesToHourMinute', () => {
  it('480 → 8:00', () => {
    expect(minutesToHourMinute(480)).toBe('8:00')
  })
  it('545 → 9:05', () => {
    expect(minutesToHourMinute(545)).toBe('9:05')
  })
  it('null → 0:00', () => {
    expect(minutesToHourMinute(null)).toBe('0:00')
  })
  it('負値は 0:00 にクランプ', () => {
    expect(minutesToHourMinute(-30)).toBe('0:00')
  })
})
