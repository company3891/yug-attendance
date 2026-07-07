import { describe, it, expect } from 'vitest'
import { decodeShiftJis, parseHolidayCsv, summarizeHolidays } from './parse'

/**
 * 内閣府CSV の Shift_JIS から変換済み（UTF-8）サンプル。
 * 実際のCSVを模し、ヘッダー行・1桁の月日・春分/秋分・うるう年2/29・CRLF・空行・末尾改行を含む。
 */
const SAMPLE_CSV =
  '国民の祝日・休日月日,国民の祝日・休日名称\r\n' +
  '2027/1/1,元日\r\n' +
  '2027/1/11,成人の日\r\n' +
  '2027/3/21,春分の日\r\n' +
  '2027/3/22,休日\r\n' +
  '2027/9/23,秋分の日\r\n' +
  '2028/2/29,テスト休日\r\n' + // うるう年
  '\r\n' + // 空行
  '2028/1/1,元日\r\n'

describe('decodeShiftJis', () => {
  it('Shift_JIS バイト列を UTF-8 にデコードする（元日）', () => {
    // 「元日」= 0x8CB3 0x93FA（Shift_JIS）
    expect(decodeShiftJis(new Uint8Array([0x8c, 0xb3, 0x93, 0xfa]))).toBe('元日')
  })
  it('ASCII（日付・数字）はそのまま通す', () => {
    const bytes = new Uint8Array([0x32, 0x30, 0x32, 0x37, 0x2f, 0x31, 0x2f, 0x31]) // "2027/1/1"
    expect(decodeShiftJis(bytes)).toBe('2027/1/1')
  })
})

describe('parseHolidayCsv', () => {
  const rows = parseHolidayCsv(SAMPLE_CSV)

  it('ヘッダー行と空行をスキップする', () => {
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.holiday_date))).toBe(true)
    expect(rows).toHaveLength(7)
  })

  it('YYYY/M/D を YYYY-MM-DD にゼロ埋め正規化する', () => {
    expect(rows[0]).toEqual({ holiday_date: '2027-01-01', name: '元日' })
    expect(rows[1]).toEqual({ holiday_date: '2027-01-11', name: '成人の日' })
  })

  it('春分・秋分・振替休日（3/22）を CSV の値どおり取り込む', () => {
    const byDate = new Map(rows.map((r) => [r.holiday_date, r.name]))
    expect(byDate.get('2027-03-21')).toBe('春分の日')
    expect(byDate.get('2027-03-22')).toBe('休日')
    expect(byDate.get('2027-09-23')).toBe('秋分の日')
  })

  it('うるう年 2/29 も取り込める', () => {
    expect(rows.find((r) => r.holiday_date === '2028-02-29')?.name).toBe('テスト休日')
  })

  it('同一日付は最初の1件だけ採用（冪等）', () => {
    const dup = parseHolidayCsv('2027/1/1,元日\n2027/1/1,元日（重複）')
    expect(dup).toHaveLength(1)
    expect(dup[0]).toEqual({ holiday_date: '2027-01-01', name: '元日' })
  })

  it('LF のみの改行にも対応する', () => {
    expect(parseHolidayCsv('2027/1/1,元日\n2027/1/11,成人の日')).toHaveLength(2)
  })

  it('空文字・ヘッダーのみは 0 件', () => {
    expect(parseHolidayCsv('')).toEqual([])
    expect(parseHolidayCsv('国民の祝日・休日月日,国民の祝日・休日名称')).toEqual([])
  })
})

describe('summarizeHolidays', () => {
  it('件数と対象年範囲を返す', () => {
    const rows = parseHolidayCsv(SAMPLE_CSV)
    expect(summarizeHolidays(rows)).toEqual({ count: 7, minYear: 2027, maxYear: 2028 })
  })
  it('0 件は年範囲 null', () => {
    expect(summarizeHolidays([])).toEqual({ count: 0, minYear: null, maxYear: null })
  })
})
