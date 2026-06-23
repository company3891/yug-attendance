import { describe, it, expect } from 'vitest'
import {
  calcLaborMinutes,
  calcMidnightMinutes,
  calcMidnightOvertimeMinutes,
  calcWorkTimeBreakdown,
  resolveWorkDate,
  type WorkTimeInput,
} from './workTime'

// Asia/Tokyo 固定で日時を生成するヘルパ
const jst = (iso: string) => new Date(`${iso}+09:00`)

// -------------------------------------------------------------------------
// A. calcLaborMinutes 基本系
// -------------------------------------------------------------------------
describe('calcLaborMinutes', () => {
  it('A1: 9:00→17:00 休憩60 = 420分 (7h)', () => {
    expect(calcLaborMinutes(jst('2026-05-23T09:00'), jst('2026-05-23T17:00'), 60)).toBe(420)
  })

  it('A2: 9:00→17:00 休憩0 = 480分 (8h)', () => {
    expect(calcLaborMinutes(jst('2026-05-23T09:00'), jst('2026-05-23T17:00'), 0)).toBe(480)
  })

  it('A3: clockIn == clockOut = 0分', () => {
    const t = jst('2026-05-23T09:00')
    expect(calcLaborMinutes(t, t, 0)).toBe(0)
  })

  it('A4: clockOut < clockIn → throw', () => {
    expect(() =>
      calcLaborMinutes(jst('2026-05-23T17:00'), jst('2026-05-23T09:00'), 0),
    ).toThrow(/clockOut must be >= clockIn/i)
  })

  it('A5: 休憩 > 実時間 → 0 にクランプ', () => {
    expect(calcLaborMinutes(jst('2026-05-23T09:00'), jst('2026-05-23T17:00'), 540)).toBe(0)
  })
})

// -------------------------------------------------------------------------
// B. calcMidnightMinutes 深夜帯
// -------------------------------------------------------------------------
describe('calcMidnightMinutes', () => {
  it('B6: 22:00ピッタリ→24:00 = 120分', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T22:00'), jst('2026-05-24T00:00'))).toBe(120)
  })

  it('B7: 21:59→22:01 = 1分', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T21:59'), jst('2026-05-23T22:01'))).toBe(1)
  })

  it('B8: 04:59→05:01 = 1分 (5:00境界)', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T04:59'), jst('2026-05-23T05:01'))).toBe(1)
  })

  it('B9: 22:00→翌05:00 = 420分 (深夜のみ)', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T22:00'), jst('2026-05-24T05:00'))).toBe(420)
  })

  it('B10: 22:00→翌06:00 = 420分 (06:00は昼)', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T22:00'), jst('2026-05-24T06:00'))).toBe(420)
  })

  it('B11: 17:00→21:00 = 0分', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T17:00'), jst('2026-05-23T21:00'))).toBe(0)
  })

  it('B12: 17:00→23:00 = 60分', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T17:00'), jst('2026-05-23T23:00'))).toBe(60)
  })

  it('B13: 09:00→23:30 = 90分', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T09:00'), jst('2026-05-23T23:30'))).toBe(90)
  })

  it('B14: 23:00→翌07:00 = 6h深夜(360分) + 2h昼', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T23:00'), jst('2026-05-24T07:00'))).toBe(360)
  })

  it('B15: 完全昼間 10:00→18:00 = 0分', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T10:00'), jst('2026-05-23T18:00'))).toBe(0)
  })

  it('B16: end == start = 0分 (早期returnガード)', () => {
    const t = jst('2026-05-23T22:00')
    expect(calcMidnightMinutes(t, t)).toBe(0)
  })

  it('B17: end < start = 0分 (異常データガード)', () => {
    expect(calcMidnightMinutes(jst('2026-05-23T23:00'), jst('2026-05-23T22:00'))).toBe(0)
  })
})

// -------------------------------------------------------------------------
// C. calcWorkTimeBreakdown 統合 8項目
// -------------------------------------------------------------------------
describe('calcWorkTimeBreakdown', () => {
  const base = (overrides: Partial<WorkTimeInput> = {}): WorkTimeInput => ({
    clockIn: jst('2026-05-23T09:00'),
    clockOut: jst('2026-05-23T17:00'),
    breakMinutes: 60,
    scheduledMinutes: 480,
    dayType: 'workday',
    ...overrides,
  })

  it('C16: 通常 9-17 休60 → labor 420 / scheduled 480 / 超過0', () => {
    const r = calcWorkTimeBreakdown(base())
    expect(r.laborMinutes).toBe(420)
    expect(r.scheduledMinutes).toBe(480)
    expect(r.overScheduledMinutes).toBe(0)
    expect(r.overLegalMinutes).toBe(0)
    expect(r.midnightMinutes).toBe(0)
    expect(r.holidayMinutes).toBe(0)
    expect(r.holidayOverMinutes).toBe(420)
    expect(r.hasAnomaly).toBe(false)
  })

  it('C17: 残業 9-19 休60 → labor 540 / overScheduled 60 / overLegal 60', () => {
    const r = calcWorkTimeBreakdown(
      base({ clockOut: jst('2026-05-23T19:00') }),
    )
    expect(r.laborMinutes).toBe(540)
    expect(r.overScheduledMinutes).toBe(60)
    expect(r.overLegalMinutes).toBe(60)
  })

  it('C18: 深夜あり 18-翌3 休60 → labor 480 / midnight 300 / midnightOver 180', () => {
    const r = calcWorkTimeBreakdown(
      base({ clockIn: jst('2026-05-23T18:00'), clockOut: jst('2026-05-24T03:00') }),
    )
    expect(r.laborMinutes).toBe(480)
    expect(r.midnightMinutes).toBe(300)
    expect(r.midnightOverMinutes).toBe(180)
  })

  it('C19: 8時間ピッタリ 9-18 休60 → overLegal 0', () => {
    const r = calcWorkTimeBreakdown(base({ clockOut: jst('2026-05-23T18:00') }))
    expect(r.laborMinutes).toBe(480)
    expect(r.overLegalMinutes).toBe(0)
  })

  it('C20: 8時間1分 → overLegal 1', () => {
    const r = calcWorkTimeBreakdown(base({ clockOut: jst('2026-05-23T18:01') }))
    expect(r.laborMinutes).toBe(481)
    expect(r.overLegalMinutes).toBe(1)
  })

  it('C21: 法定休日 9-17 休60 → holiday 420 / holidayOver 0', () => {
    const r = calcWorkTimeBreakdown(base({ dayType: 'legal_holiday' }))
    expect(r.holidayMinutes).toBe(420)
    expect(r.holidayOverMinutes).toBe(0)
  })

  it('C22: 所定休日 9-17 休60 → overScheduled 420 (25%扱い) / holiday 0', () => {
    const r = calcWorkTimeBreakdown(base({ dayType: 'scheduled_holiday' }))
    expect(r.holidayMinutes).toBe(0)
    expect(r.overScheduledMinutes).toBe(420)
  })

  it('C23-1: 法定休日 + 深夜 17-翌3 休60 → holiday 480, midnight 300, overLegal 0', () => {
    const r = calcWorkTimeBreakdown(
      base({
        clockIn: jst('2026-05-24T17:00'),
        clockOut: jst('2026-05-25T03:00'),
        dayType: 'legal_holiday',
      }),
    )
    expect(r.laborMinutes).toBe(540)
    expect(r.holidayMinutes).toBe(540)
    expect(r.midnightMinutes).toBe(300)
  })

  it('C23-2: 所定休日 + 深夜 → overScheduled 540 + midnight 300', () => {
    const r = calcWorkTimeBreakdown(
      base({
        clockIn: jst('2026-05-24T17:00'),
        clockOut: jst('2026-05-25T03:00'),
        dayType: 'scheduled_holiday',
      }),
    )
    expect(r.overScheduledMinutes).toBe(540)
    expect(r.midnightMinutes).toBe(300)
  })

  it('C24: 飲食店典型 17:00→翌2:00 休60 → 深夜240 (raw)、overLegal 0', () => {
    // 仕様判断: 休憩は非深夜時間から優先控除（飲食店の典型: 夕方に休憩）
    // → midnight は 22:00→翌02:00 の raw 240分のまま、休憩は 17:00-22:00 から差し引く
    const r = calcWorkTimeBreakdown(
      base({
        clockIn: jst('2026-05-23T17:00'),
        clockOut: jst('2026-05-24T02:00'),
        breakMinutes: 60,
      }),
    )
    expect(r.laborMinutes).toBe(480) // 9h - 1h休 = 8h
    expect(r.midnightMinutes).toBe(240) // 22:00→翌02:00 = 4h (休憩は非深夜から控除)
    expect(r.midnightOverMinutes).toBe(240) // labor 480 - midnight 240
    expect(r.overLegalMinutes).toBe(0) // 8h ピッタリ
  })
})

// -------------------------------------------------------------------------
// D. resolveWorkDate（day_start_time考慮）
// -------------------------------------------------------------------------
describe('resolveWorkDate', () => {
  it('D-day1: day_start=00:00 で 02:00 打刻 → 当日扱い', () => {
    expect(resolveWorkDate(jst('2026-05-24T02:00'), '00:00')).toBe('2026-05-24')
  })

  it('D-day2: day_start=05:00 で 翌02:00 打刻 → 前日扱い', () => {
    expect(resolveWorkDate(jst('2026-05-24T02:00'), '05:00')).toBe('2026-05-23')
  })

  it('D-day3: day_start=05:00 で 05:00 打刻 → 当日扱い', () => {
    expect(resolveWorkDate(jst('2026-05-24T05:00'), '05:00')).toBe('2026-05-24')
  })

  it('D-day4: day_start=05:00 で 04:59 打刻 → 前日扱い', () => {
    expect(resolveWorkDate(jst('2026-05-24T04:59'), '05:00')).toBe('2026-05-23')
  })

  it('D-day5: day_start=5 (分省略) → 5:00と同等扱い', () => {
    expect(resolveWorkDate(jst('2026-05-24T04:59'), '5')).toBe('2026-05-23')
    expect(resolveWorkDate(jst('2026-05-24T05:00'), '5')).toBe('2026-05-24')
  })
})

// -------------------------------------------------------------------------
// E. 異常検知 (has_anomaly)
// -------------------------------------------------------------------------
describe('calcWorkTimeBreakdown - anomaly detection', () => {
  it('E1: clockOut < clockIn → throw (有効化はAPI側責務)', () => {
    expect(() =>
      calcWorkTimeBreakdown({
        clockIn: jst('2026-05-23T17:00'),
        clockOut: jst('2026-05-23T09:00'),
        breakMinutes: 0,
        scheduledMinutes: 480,
        dayType: 'workday',
      }),
    ).toThrow()
  })

  it('E2: 休憩 > 実時間 → hasAnomaly=true / labor=0 / anomalyCodes に break_exceeds_work', () => {
    const r = calcWorkTimeBreakdown({
      clockIn: jst('2026-05-23T09:00'),
      clockOut: jst('2026-05-23T17:00'),
      breakMinutes: 540,
      scheduledMinutes: 480,
      dayType: 'workday',
    })
    expect(r.laborMinutes).toBe(0)
    expect(r.hasAnomaly).toBe(true)
    expect(r.anomalyCodes).toContain('break_exceeds_work')
  })

  it('E3: 24h超勤務 → hasAnomaly=true / anomalyCodes に duration_over_24h', () => {
    const r = calcWorkTimeBreakdown({
      clockIn: jst('2026-05-23T09:00'),
      clockOut: jst('2026-05-24T10:00'),
      breakMinutes: 60,
      scheduledMinutes: 480,
      dayType: 'workday',
    })
    expect(r.laborMinutes).toBe(1440)
    expect(r.hasAnomaly).toBe(true)
    expect(r.anomalyCodes).toContain('duration_over_24h')
  })

  it('E4: 通常勤務 → hasAnomaly=false / anomalyCodes=[]', () => {
    const r = calcWorkTimeBreakdown({
      clockIn: jst('2026-05-23T09:00'),
      clockOut: jst('2026-05-23T17:00'),
      breakMinutes: 60,
      scheduledMinutes: 480,
      dayType: 'workday',
    })
    expect(r.hasAnomaly).toBe(false)
    expect(r.anomalyCodes).toEqual([])
  })

  it('E5: 複合異常 (休憩超過 + 24h超) → anomalyCodes に両方', () => {
    const r = calcWorkTimeBreakdown({
      clockIn: jst('2026-05-23T09:00'),
      clockOut: jst('2026-05-24T11:00'),
      breakMinutes: 2000, // 異常な休憩値
      scheduledMinutes: 480,
      dayType: 'workday',
    })
    expect(r.hasAnomaly).toBe(true)
    expect(r.anomalyCodes).toContain('break_exceeds_work')
    expect(r.anomalyCodes).toContain('duration_over_24h')
  })
})

// -------------------------------------------------------------------------
// F. calcMidnightOvertimeMinutes 深夜残業（深夜 ∩ 法定外残業、深夜の内数）
// -------------------------------------------------------------------------
describe('F. calcMidnightOvertimeMinutes', () => {
  it('F1: 残業なし(ちょうど8h) → 0', () => {
    // 18:00→翌03:00 休60 = net 480 (overtime 0)
    expect(
      calcMidnightOvertimeMinutes(jst('2026-05-23T18:00'), jst('2026-05-24T03:00'), 60),
    ).toBe(0)
  })

  it('F2: 16:00→翌03:00 休60 = net600, 残業120 → 末尾[01:00,03:00]は全て深夜 → 120', () => {
    const v = calcMidnightOvertimeMinutes(jst('2026-05-23T16:00'), jst('2026-05-24T03:00'), 60)
    expect(v).toBe(120)
  })

  it('F3: 09:00→23:00 休60 = net780, 残業300 → 末尾[18:00,23:00]の深夜は22-23の60分のみ', () => {
    const v = calcMidnightOvertimeMinutes(jst('2026-05-23T09:00'), jst('2026-05-23T23:00'), 60)
    expect(v).toBe(60)
  })

  it('F4: 深夜なし日中残業（08:00→20:00 休60 = net660, 残業180、深夜帯ゼロ）→ 0', () => {
    const v = calcMidnightOvertimeMinutes(jst('2026-05-23T08:00'), jst('2026-05-23T20:00'), 60)
    expect(v).toBe(0)
  })

  it('F5: 深夜残業は深夜総量の内数（≤ midnightMinutes）', () => {
    const clockIn = jst('2026-05-23T16:00')
    const clockOut = jst('2026-05-24T03:00')
    const breakMin = 60
    const breakdown = calcWorkTimeBreakdown({
      clockIn,
      clockOut,
      breakMinutes: breakMin,
      scheduledMinutes: 480,
      dayType: 'workday',
    })
    const moT = calcMidnightOvertimeMinutes(clockIn, clockOut, breakMin)
    expect(moT).toBeLessThanOrEqual(breakdown.midnightMinutes)
  })

  it('F6: clockOut <= clockIn → 0', () => {
    expect(
      calcMidnightOvertimeMinutes(jst('2026-05-23T18:00'), jst('2026-05-23T18:00'), 0),
    ).toBe(0)
  })
})
