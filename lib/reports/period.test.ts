import { describe, it, expect } from 'vitest'
import {
  periodLabel,
  periodSlug,
  monthRange,
  reportFilename,
  contentDisposition,
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
