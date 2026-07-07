import { describe, it, expect } from 'vitest'
import { buildAttendanceBookSheet, type AttendanceBookHeader, type BookDailySource } from './layout'

const header: AttendanceBookHeader = {
  companyName: '株式会社YUG',
  storeName: '本店',
  employeeName: '倉片一郎',
  employeeNo: 'E-001',
  jobTitle: 'ホール',
  year: 2026,
  month: 6,
}

/** 実打刻がある日の行を作る（区分は buildReportRow 済みの想定値を直接指定） */
function src(workDate: string, over: Partial<BookDailySource> = {}): BookDailySource {
  return {
    userId: 'u-1',
    userName: '倉片一郎',
    storeName: '本店',
    workDate,
    clockIn: `${workDate}T00:00:00.000Z`, // JST 09:00
    clockOut: `${workDate}T08:00:00.000Z`, // JST 17:00
    laborMinutes: 480,
    scheduledInMinutes: 480,
    overScheduledMinutes: 0,
    overLegalMinutes: 0,
    midnightMinutes: 0,
    midnightOvertimeMinutes: 0,
    holidayMinutes: 0,
    wageType: null,
    unitWage: null,
    estimatedPay: null,
    breakMinutes: 60,
    ...over,
  }
}

describe('buildAttendanceBookSheet', () => {
  it('当月の全日を並べる（6月=30日）', () => {
    const sheet = buildAttendanceBookSheet(header, [])
    expect(sheet.days).toHaveLength(30)
    expect(sheet.days[0]!.workDate).toBe('2026-06-01')
    expect(sheet.days[29]!.workDate).toBe('2026-06-30')
  })

  it('打刻の無い日は hasRecord=false・各値 null（「－」表示用）', () => {
    const sheet = buildAttendanceBookSheet(header, [src('2026-06-15')])
    const d1 = sheet.days.find((d) => d.workDate === '2026-06-01')!
    expect(d1.hasRecord).toBe(false)
    expect(d1.laborMinutes).toBeNull()
    expect(d1.breakMinutes).toBeNull()
    expect(d1.clockIn).toBeNull()
  })

  it('打刻のある日は値が入り、休憩分も引き継ぐ', () => {
    const sheet = buildAttendanceBookSheet(header, [
      src('2026-06-15', { laborMinutes: 600, overScheduledMinutes: 120, breakMinutes: 45 }),
    ])
    const d = sheet.days.find((d) => d.workDate === '2026-06-15')!
    expect(d.hasRecord).toBe(true)
    expect(d.laborMinutes).toBe(600)
    expect(d.overScheduledMinutes).toBe(120)
    expect(d.breakMinutes).toBe(45)
  })

  it('日付ラベル・曜日・土日判定', () => {
    const sheet = buildAttendanceBookSheet(header, [])
    const mon = sheet.days.find((d) => d.workDate === '2026-06-01')!
    const sat = sheet.days.find((d) => d.workDate === '2026-06-06')!
    const sun = sheet.days.find((d) => d.workDate === '2026-06-07')!
    expect(mon).toMatchObject({ dateLabel: '6/1', weekday: '月', isWeekend: false })
    expect(sat).toMatchObject({ dateLabel: '6/6', weekday: '土', isWeekend: true })
    expect(sun).toMatchObject({ weekday: '日', isWeekend: true })
  })

  it('集計: 出勤日数は clock_in のある日数、区分は sumReportRows 相当', () => {
    const sheet = buildAttendanceBookSheet(header, [
      src('2026-06-01', { laborMinutes: 480, scheduledInMinutes: 480 }),
      src('2026-06-02', { laborMinutes: 600, scheduledInMinutes: 480, overScheduledMinutes: 120 }),
      src('2026-06-03', {
        laborMinutes: 300,
        scheduledInMinutes: 300,
        holidayMinutes: 300,
        midnightMinutes: 60,
      }),
    ])
    expect(sheet.totals.workdayCount).toBe(3)
    expect(sheet.totals.laborMinutes).toBe(1380)
    expect(sheet.totals.scheduledInMinutes).toBe(1260)
    expect(sheet.totals.overScheduledMinutes).toBe(120)
    expect(sheet.totals.holidayMinutes).toBe(300)
    expect(sheet.totals.midnightMinutes).toBe(60)
  })

  it('出勤日数は clock_in が null の行を除外する', () => {
    const sheet = buildAttendanceBookSheet(header, [
      src('2026-06-01'),
      src('2026-06-02', { clockIn: null, clockOut: null, laborMinutes: 0 }),
    ])
    expect(sheet.totals.workdayCount).toBe(1)
  })
})
