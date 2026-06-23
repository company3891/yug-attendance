import { describe, it, expect } from 'vitest'
import {
  buildReportRow,
  estimatePay,
  sumReportRows,
  type ReportRowInput,
  type WtcMinutes,
} from './build'

const wtc = (over: Partial<WtcMinutes> = {}): WtcMinutes => ({
  labor_minutes: 480,
  scheduled_minutes: 480,
  over_scheduled_minutes: 0,
  over_legal_minutes: 0,
  midnight_minutes: 0,
  midnight_over_minutes: 480,
  holiday_minutes: 0,
  holiday_over_minutes: 480,
  ...over,
})

const base: ReportRowInput = {
  userId: 'u-0001',
  userName: '山田太郎',
  storeName: '本店',
  workDate: '2026-06-01',
  clockIn: '2026-06-01T00:00:00.000Z', // JST 09:00
  clockOut: '2026-06-01T08:00:00.000Z', // JST 17:00
  breakMinutes: 0,
  wtc: wtc(),
  wageType: 'hourly',
  hourlyWage: 1200,
  monthlyWage: null,
  dailyWage: null,
}

describe('buildReportRow 列対応', () => {
  it('所定内 = labor - 所定外', () => {
    const r = buildReportRow({
      ...base,
      wtc: wtc({ labor_minutes: 600, over_scheduled_minutes: 120 }),
    })
    expect(r.laborMinutes).toBe(600)
    expect(r.overScheduledMinutes).toBe(120)
    expect(r.scheduledInMinutes).toBe(480)
  })

  it('null wtc は全て 0', () => {
    const r = buildReportRow({ ...base, wtc: null })
    expect(r.laborMinutes).toBe(0)
    expect(r.scheduledInMinutes).toBe(0)
  })

  it('深夜残業 = 深夜∩法定外残業（clock時刻から算出、深夜列の内数）', () => {
    // 16:00→翌03:00 休60 = net600, 残業120。末尾[01:00,03:00] は全て深夜 → 深夜残業120
    const r = buildReportRow({
      ...base,
      clockIn: '2026-06-01T07:00:00.000Z', // JST 16:00
      clockOut: '2026-06-01T18:00:00.000Z', // JST 翌03:00
      breakMinutes: 60,
      wtc: wtc({ labor_minutes: 600, midnight_minutes: 300 }),
    })
    expect(r.midnightOvertimeMinutes).toBe(120)
    expect(r.midnightOvertimeMinutes).toBeLessThanOrEqual(r.midnightMinutes) // 内数
  })

  it('深夜残業: 残業なし(日中8h)は 0', () => {
    const r = buildReportRow({ ...base, breakMinutes: 0 }) // 09:00-17:00 = 8h, 残業0
    expect(r.midnightOvertimeMinutes).toBe(0)
  })

  it('深夜残業: clock_out 欠損なら 0', () => {
    const r = buildReportRow({ ...base, clockOut: null })
    expect(r.midnightOvertimeMinutes).toBe(0)
  })

  it('単価は wage_type に対応した値', () => {
    expect(buildReportRow(base).unitWage).toBe(1200)
    expect(
      buildReportRow({ ...base, wageType: 'daily', hourlyWage: null, dailyWage: 10000 }).unitWage,
    ).toBe(10000)
    expect(
      buildReportRow({ ...base, wageType: 'monthly', hourlyWage: null, monthlyWage: 250000 })
        .unitWage,
    ).toBe(250000)
  })
})

describe('estimatePay 概算支給額', () => {
  it('時給: 所定内8h×1200 = 9600', () => {
    const pay = estimatePay({
      wageType: 'hourly',
      hourlyWage: 1200,
      dailyWage: null,
      scheduledInMinutes: 480,
      overScheduledMinutes: 0,
      midnightMinutes: 0,
      holidayMinutes: 0,
      laborMinutes: 480,
    })
    expect(pay).toBe(9600)
  })

  it('時給: 所定内8h + 所定外2h×1.25 + 深夜1h×0.25', () => {
    // 8*1200 + 2*1200*1.25 + 1*1200*0.25 = 9600 + 3000 + 300 = 12900
    const pay = estimatePay({
      wageType: 'hourly',
      hourlyWage: 1200,
      dailyWage: null,
      scheduledInMinutes: 480,
      overScheduledMinutes: 120,
      midnightMinutes: 60,
      holidayMinutes: 0,
      laborMinutes: 600,
    })
    expect(pay).toBe(12900)
  })

  it('時給: 法定休日5h×0.35割増', () => {
    // 5*1000*0.35 = 1750（所定内0想定）
    const pay = estimatePay({
      wageType: 'hourly',
      hourlyWage: 1000,
      dailyWage: null,
      scheduledInMinutes: 0,
      overScheduledMinutes: 0,
      midnightMinutes: 0,
      holidayMinutes: 300,
      laborMinutes: 300,
    })
    expect(pay).toBe(1750)
  })

  it('日給: 実労働ありで日給1日ぶん', () => {
    expect(
      estimatePay({
        wageType: 'daily',
        hourlyWage: null,
        dailyWage: 10000,
        scheduledInMinutes: 480,
        overScheduledMinutes: 0,
        midnightMinutes: 0,
        holidayMinutes: 0,
        laborMinutes: 480,
      }),
    ).toBe(10000)
  })

  it('日給: 実労働0なら0', () => {
    expect(
      estimatePay({
        wageType: 'daily',
        hourlyWage: null,
        dailyWage: 10000,
        scheduledInMinutes: 0,
        overScheduledMinutes: 0,
        midnightMinutes: 0,
        holidayMinutes: 0,
        laborMinutes: 0,
      }),
    ).toBe(0)
  })

  it('月給: per-row は null', () => {
    expect(
      estimatePay({
        wageType: 'monthly',
        hourlyWage: null,
        dailyWage: null,
        scheduledInMinutes: 480,
        overScheduledMinutes: 0,
        midnightMinutes: 0,
        holidayMinutes: 0,
        laborMinutes: 480,
      }),
    ).toBeNull()
  })

  it('時給だが単価 null は null', () => {
    expect(
      estimatePay({
        wageType: 'hourly',
        hourlyWage: null,
        dailyWage: null,
        scheduledInMinutes: 480,
        overScheduledMinutes: 0,
        midnightMinutes: 0,
        holidayMinutes: 0,
        laborMinutes: 480,
      }),
    ).toBeNull()
  })
})

describe('sumReportRows 合計', () => {
  it('複数行を SUM 相当で集計（月給 null は0扱い）', () => {
    const rows = [
      buildReportRow({ ...base, wtc: wtc({ labor_minutes: 480 }) }),
      buildReportRow({
        ...base,
        wtc: wtc({ labor_minutes: 600, over_scheduled_minutes: 120 }),
      }),
      buildReportRow({ ...base, wageType: 'monthly', hourlyWage: null, monthlyWage: 250000 }),
    ]
    const t = sumReportRows(rows)
    expect(t.laborMinutes).toBe(480 + 600 + 480)
    expect(t.overScheduledMinutes).toBe(120)
    // row1: 所定内8h×1200 = 9600
    // row2: 所定内8h×1200 + 所定外2h×1200×1.25 = 9600 + 3000 = 12600
    // row3(月給): null → 0
    expect(t.estimatedPay).toBe(9600 + 12600 + 0)
  })
})
