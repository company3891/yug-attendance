import { describe, it, expect } from 'vitest'
import {
  periodLabel,
  periodSlug,
  monthRange,
  reportFilename,
  contentDisposition,
  eachDayOfMonth,
  eachMonthInRange,
  bookPeriodSlug,
  bookContentDisposition,
} from './period'

describe('period helpers', () => {
  it('periodLabel', () => {
    expect(periodLabel(2026, 6)).toBe('2026年6月')
  })
  it('periodSlug はゼロ埋め', () => {
    expect(periodSlug(2026, 6)).toBe('2026-06')
    expect(periodSlug(2026, 12)).toBe('2026-12')
  })
  it('monthRange: 6月は 01〜30', () => {
    expect(monthRange(2026, 6)).toEqual({ start: '2026-06-01', end: '2026-06-30' })
  })
  it('monthRange: 2月(閏年2028)は 01〜29', () => {
    expect(monthRange(2028, 2)).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
  it('monthRange: 2月(平年2026)は 01〜28', () => {
    expect(monthRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
  it('reportFilename', () => {
    expect(reportFilename(2026, 6, 'csv')).toBe('attendance-report_2026-06.csv')
    expect(reportFilename(2026, 6, 'xlsx')).toBe('attendance-report_2026-06.xlsx')
  })
  it('contentDisposition は attachment + 日本語ファイル名(RFC5987)', () => {
    const cd = contentDisposition(2026, 6, 'csv')
    expect(cd).toContain('attachment')
    expect(cd).toContain('filename="attendance-report_2026-06.csv"')
    expect(cd).toContain("filename*=UTF-8''")
    expect(cd).toContain(encodeURIComponent('勤怠レポート_2026-06.csv'))
  })
})

describe('eachDayOfMonth', () => {
  it('6月は 30 日ぶん、先頭/末尾が正しい', () => {
    const days = eachDayOfMonth(2026, 6)
    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-06-01')
    expect(days[29]).toBe('2026-06-30')
  })
  it('平年2月は 28 日、閏年2月は 29 日', () => {
    expect(eachDayOfMonth(2026, 2)).toHaveLength(28)
    expect(eachDayOfMonth(2028, 2)).toHaveLength(29)
    expect(eachDayOfMonth(2028, 2)[28]).toBe('2028-02-29')
  })
  it('ゼロ埋めされる', () => {
    expect(eachDayOfMonth(2026, 1)[0]).toBe('2026-01-01')
  })
})

describe('eachMonthInRange', () => {
  it('単月は1件', () => {
    expect(eachMonthInRange({ year: 2026, month: 4 }, { year: 2026, month: 4 })).toEqual([
      { year: 2026, month: 4 },
    ])
  })
  it('4〜6月は3件・昇順', () => {
    expect(eachMonthInRange({ year: 2026, month: 4 }, { year: 2026, month: 6 })).toEqual([
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ])
  })
  it('年をまたぐ（2026-12〜2027-02）', () => {
    expect(eachMonthInRange({ year: 2026, month: 12 }, { year: 2027, month: 2 })).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ])
  })
  it('from > to は空配列', () => {
    expect(eachMonthInRange({ year: 2026, month: 6 }, { year: 2026, month: 4 })).toEqual([])
  })
})

describe('book ファイル名ヘルパ', () => {
  it('bookPeriodSlug: 単月は1つ、複数月は from_to', () => {
    expect(bookPeriodSlug({ year: 2026, month: 4 }, { year: 2026, month: 4 })).toBe('2026-04')
    expect(bookPeriodSlug({ year: 2026, month: 4 }, { year: 2026, month: 6 })).toBe(
      '2026-04_2026-06',
    )
  })
  it('bookContentDisposition は attachment + 日本語ファイル名(RFC5987)', () => {
    const cd = bookContentDisposition({ year: 2026, month: 4 }, { year: 2026, month: 6 })
    expect(cd).toContain('attachment')
    expect(cd).toContain('filename="attendance-book_2026-04_2026-06.xlsx"')
    expect(cd).toContain("filename*=UTF-8''")
    expect(cd).toContain(encodeURIComponent('出勤簿_2026-04_2026-06.xlsx'))
  })
})
