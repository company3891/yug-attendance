import { describe, it, expect } from 'vitest'
import { buildCsv, csvEscape, reportRowToCsvCells, CSV_HEADERS } from './csv'
import { buildReportRow, type ReportRowInput } from './build'

const input: ReportRowInput = {
  userId: 'u-0001',
  userName: '山田太郎',
  storeName: '本店',
  workDate: '2026-06-01',
  clockIn: '2026-06-01T00:00:00.000Z', // JST 09:00
  clockOut: '2026-06-01T08:30:00.000Z', // JST 17:30
  breakMinutes: 0,
  wtc: {
    labor_minutes: 510,
    scheduled_minutes: 480,
    over_scheduled_minutes: 30,
    over_legal_minutes: 30,
    midnight_minutes: 0,
    midnight_over_minutes: 510,
    holiday_minutes: 0,
    holiday_over_minutes: 510,
  },
  wageType: 'hourly',
  hourlyWage: 1200,
  monthlyWage: null,
  dailyWage: null,
}

describe('csvEscape', () => {
  it('カンマを含む値はクオート', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })
  it('ダブルクオートは2重化', () => {
    expect(csvEscape('a"b')).toBe('"a""b"')
  })
  it('改行を含む値はクオート', () => {
    expect(csvEscape('a\nb')).toBe('"a\nb"')
  })
  it('通常値はそのまま', () => {
    expect(csvEscape('本店')).toBe('本店')
  })
  it('null/undefined は空文字', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })
})

describe('reportRowToCsvCells', () => {
  it('15列・JST時刻・H:MM・概算支給額', () => {
    const cells = reportRowToCsvCells(buildReportRow(input))
    expect(cells).toHaveLength(15)
    expect(cells[0]).toBe('山田太郎')
    expect(cells[1]).toBe('本店')
    expect(cells[2]).toBe('2026-06-01')
    expect(cells[3]).toBe('2026-06-01 09:00') // 出勤 JST
    expect(cells[4]).toBe('2026-06-01 17:30') // 退勤 JST
    expect(cells[5]).toBe('8:30') // 労働
    expect(cells[6]).toBe('8:00') // 所定内 = 510-30=480
    expect(cells[7]).toBe('0:30') // 所定外
    expect(cells[8]).toBe('0:30') // 法定外残業
    expect(cells[9]).toBe('0:00') // 深夜（日中勤務なので0）
    expect(cells[10]).toBe('0:00') // 深夜残業（内数・0）
    expect(cells[12]).toBe('時給')
    expect(cells[13]).toBe('1200')
    // 概算: 8h×1200 + 0.5h×1200×1.25 = 9600 + 750 = 10350
    expect(cells[14]).toBe('10350')
  })
})

describe('buildCsv', () => {
  const csv = buildCsv([buildReportRow(input)])

  it('BOM で始まる', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
  it('CRLF 区切り', () => {
    expect(csv).toContain('\r\n')
    // 行は CRLF で終端
    expect(csv.endsWith('\r\n')).toBe(true)
  })
  it('ヘッダー行が15列', () => {
    const body = csv.slice(1) // BOM 除去
    const headerLine = body.split('\r\n')[0] ?? ''
    expect(headerLine.split(',')).toHaveLength(15)
    expect(headerLine.split(',')[0]).toBe('従業員名')
    expect(headerLine.split(',')[14]).toBe('概算支給額')
  })
  it('ヘッダー定数は仕様の15列', () => {
    expect(CSV_HEADERS).toHaveLength(15)
  })
})
