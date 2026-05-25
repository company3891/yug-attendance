import { describe, it, expect } from 'vitest'
import { decideClockEvent, DUPLICATE_CLOCK_WINDOW_SECONDS } from './clockLogic'

const jst = (iso: string) => new Date(`${iso}+09:00`)

describe('decideClockEvent', () => {
  // ─────────────────────────────────────────
  // 出勤判定
  // ─────────────────────────────────────────
  it('当日レコード無し → clock_in', () => {
    const r = decideClockEvent({
      now: jst('2026-05-23T09:00'),
      dayStartTime: '05:00',
      todayRecord: null,
      lastEventAt: null,
    })
    expect(r.kind).toBe('clock_in')
    if (r.kind === 'clock_in') expect(r.workDate).toBe('2026-05-23')
  })

  it('深夜打刻 (翌02:00) + day_start=05:00 → workDate は前日扱い', () => {
    const r = decideClockEvent({
      now: jst('2026-05-24T02:00'),
      dayStartTime: '05:00',
      todayRecord: null,
      lastEventAt: null,
    })
    expect(r.kind).toBe('clock_in')
    if (r.kind === 'clock_in') expect(r.workDate).toBe('2026-05-23')
  })

  // ─────────────────────────────────────────
  // 退勤判定
  // ─────────────────────────────────────────
  it('出勤済み・退勤未 → clock_out', () => {
    const r = decideClockEvent({
      now: jst('2026-05-23T18:00'),
      dayStartTime: '05:00',
      todayRecord: {
        id: 'att-1',
        user_id: 'u1',
        work_date: '2026-05-23',
        clock_in: '2026-05-23T00:00:00Z',
        clock_out: null,
      },
      lastEventAt: jst('2026-05-23T09:00'),
    })
    expect(r.kind).toBe('clock_out')
    if (r.kind === 'clock_out') {
      expect(r.attendanceId).toBe('att-1')
      expect(r.workDate).toBe('2026-05-23')
    }
  })

  // ─────────────────────────────────────────
  // 3回目以降 拒否
  // ─────────────────────────────────────────
  it('出退勤両方済み → CLOCK_ALREADY_CLOSED', () => {
    const r = decideClockEvent({
      now: jst('2026-05-23T20:00'),
      dayStartTime: '05:00',
      todayRecord: {
        id: 'att-1',
        user_id: 'u1',
        work_date: '2026-05-23',
        clock_in: '2026-05-23T00:00:00Z',
        clock_out: '2026-05-23T09:00:00Z',
      },
      lastEventAt: jst('2026-05-23T18:00'),
    })
    expect(r.kind).toBe('reject')
    if (r.kind === 'reject') expect(r.code).toBe('CLOCK_ALREADY_CLOSED')
  })

  // ─────────────────────────────────────────
  // 連続打刻防止
  // ─────────────────────────────────────────
  it(`直前から ${DUPLICATE_CLOCK_WINDOW_SECONDS - 1}秒 → CLOCK_TOO_FREQUENT`, () => {
    const last = jst('2026-05-23T09:00:00')
    const now = new Date(last.getTime() + (DUPLICATE_CLOCK_WINDOW_SECONDS - 1) * 1000)
    const r = decideClockEvent({
      now,
      dayStartTime: '05:00',
      todayRecord: null,
      lastEventAt: last,
    })
    expect(r.kind).toBe('reject')
    if (r.kind === 'reject') {
      expect(r.code).toBe('CLOCK_TOO_FREQUENT')
      expect(r.lastClockAt).toBeDefined()
    }
  })

  it(`直前から ${DUPLICATE_CLOCK_WINDOW_SECONDS} 秒ピッタリ → 受理`, () => {
    const last = jst('2026-05-23T09:00:00')
    const now = new Date(last.getTime() + DUPLICATE_CLOCK_WINDOW_SECONDS * 1000)
    const r = decideClockEvent({
      now,
      dayStartTime: '05:00',
      todayRecord: null,
      lastEventAt: last,
    })
    expect(r.kind).toBe('clock_in')
  })

  it('直前イベントなし (初打刻) → 受理', () => {
    const r = decideClockEvent({
      now: jst('2026-05-23T09:00'),
      dayStartTime: '05:00',
      todayRecord: null,
      lastEventAt: null,
    })
    expect(r.kind).toBe('clock_in')
  })

  // ─────────────────────────────────────────
  // フルパス シナリオ統合
  // ─────────────────────────────────────────
  it('シナリオ: 正常出勤 → 5秒後の連続打刻拒否 → 8時間後の退勤 → 3回目拒否', () => {
    let lastEvent: Date | null = null
    let record: import('./clockLogic').AttendanceSnapshot | null = null

    // 1) 出勤
    const r1 = decideClockEvent({
      now: jst('2026-05-23T09:00'),
      dayStartTime: '05:00',
      todayRecord: record,
      lastEventAt: lastEvent,
    })
    expect(r1.kind).toBe('clock_in')
    lastEvent = jst('2026-05-23T09:00')
    record = {
      id: 'a',
      user_id: 'u',
      work_date: '2026-05-23',
      clock_in: lastEvent.toISOString(),
      clock_out: null,
    }

    // 2) 5秒後の打刻 → 拒否
    const r2 = decideClockEvent({
      now: new Date(lastEvent.getTime() + 5000),
      dayStartTime: '05:00',
      todayRecord: record,
      lastEventAt: lastEvent,
    })
    expect(r2.kind).toBe('reject')
    if (r2.kind === 'reject') expect(r2.code).toBe('CLOCK_TOO_FREQUENT')

    // 3) 8時間後 → 退勤
    const out = jst('2026-05-23T17:00')
    const r3 = decideClockEvent({
      now: out,
      dayStartTime: '05:00',
      todayRecord: record,
      lastEventAt: lastEvent,
    })
    expect(r3.kind).toBe('clock_out')
    lastEvent = out
    record = { ...record, clock_out: out.toISOString() }

    // 4) 3回目 → 拒否
    const r4 = decideClockEvent({
      now: jst('2026-05-23T19:00'),
      dayStartTime: '05:00',
      todayRecord: record,
      lastEventAt: lastEvent,
    })
    expect(r4.kind).toBe('reject')
    if (r4.kind === 'reject') expect(r4.code).toBe('CLOCK_ALREADY_CLOSED')
  })
})
