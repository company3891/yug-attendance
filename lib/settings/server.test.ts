import { describe, it, expect } from 'vitest'
import { resolveDayCalcSettings } from './server'
import { calcWorkTimeBreakdown } from '@/lib/workTime'

/**
 * settings リゾルバの DB アクセスをモックし、resolveDayCalcSettings → calcWorkTimeBreakdown の
 * 「実データ経路」を検証する。設定取得（DB）と純関数（解決ロジック）の境界が保たれていること、
 * 所定を変えると所定内/所定外の境界が動くことを固定する。
 */
interface TableData {
  work_rules?: unknown[]
  users?: unknown
  holiday_settings?: unknown[]
  japan_holidays?: unknown
}

function mockClient(byTable: TableData) {
  return {
    from(table: keyof TableData) {
      const chain: Record<string, unknown> = {}
      const payload = () => ({
        data: byTable[table] ?? (Array.isArray(byTable[table]) ? [] : null),
        error: null,
      })
      chain.select = () => chain
      chain.eq = () => chain
      chain.maybeSingle = () => Promise.resolve(payload())
      chain.then = (resolve: (v: unknown) => void) => resolve(payload())
      return chain
    },
  } as unknown as Parameters<typeof resolveDayCalcSettings>[0]
}

const companyRule = (min: number) => ({
  scope: 'company',
  company_id: 'c1',
  store_id: null,
  effective_from: '2020-01-01',
  scheduled_minutes: min,
  work_start: '09:00',
  work_end: '18:00',
  break_minutes: 0,
})
const storeRule = (min: number) => ({
  scope: 'store',
  company_id: 'c1',
  store_id: 's1',
  effective_from: '2026-01-01',
  scheduled_minutes: min,
  work_start: '09:00',
  work_end: '18:00',
  break_minutes: 0,
})
const holiday = (over: Record<string, unknown> = {}) => ({
  scope: 'company',
  store_id: null,
  scheduled_holidays: [6],
  legal_holiday: 0,
  holiday_as: 'scheduled_holiday',
  ...over,
})

// JST 09:00-18:00（9h勤務、休憩0 → labor 540）
const clockIn = new Date('2026-06-23T00:00:00.000Z')
const clockOut = new Date('2026-06-23T09:00:00.000Z')

const args = { companyId: 'c1', storeId: 's1', userId: 'u1', workDate: '2026-06-23' } // 火曜

describe('resolveDayCalcSettings（リゾルバ層・DBモック）', () => {
  it('会社デフォルトの所定を解決（平日→workday）', async () => {
    const sb = mockClient({
      work_rules: [companyRule(480)],
      users: { daily_work_minutes: null },
      holiday_settings: [holiday()],
      japan_holidays: null,
    })
    const r = await resolveDayCalcSettings(sb, args)
    expect(r.scheduledMinutes).toBe(480)
    expect(r.dayType).toBe('workday')
  })

  it('店舗上書きの所定が会社より優先される', async () => {
    const sb = mockClient({
      work_rules: [companyRule(480), storeRule(420)],
      users: { daily_work_minutes: null },
      holiday_settings: [holiday()],
      japan_holidays: null,
    })
    const r = await resolveDayCalcSettings(sb, args)
    expect(r.scheduledMinutes).toBe(420)
  })

  it('個人別上書き(users.daily_work_minutes)が最優先', async () => {
    const sb = mockClient({
      work_rules: [companyRule(480), storeRule(420)],
      users: { daily_work_minutes: 360 },
      holiday_settings: [holiday()],
      japan_holidays: null,
    })
    const r = await resolveDayCalcSettings(sb, args)
    expect(r.scheduledMinutes).toBe(360)
  })

  it('所定を変えると所定内/所定外の境界が動く（実データ経路）', async () => {
    // 所定480: labor540 → 所定内480 / 所定外60
    const sb480 = mockClient({
      work_rules: [companyRule(480)],
      users: { daily_work_minutes: null },
      holiday_settings: [holiday()],
      japan_holidays: null,
    })
    const s480 = await resolveDayCalcSettings(sb480, args)
    const b480 = calcWorkTimeBreakdown({
      clockIn,
      clockOut,
      breakMinutes: 0,
      scheduledMinutes: s480.scheduledMinutes,
      dayType: s480.dayType,
    })
    expect(b480.laborMinutes).toBe(540)
    expect(b480.overScheduledMinutes).toBe(60)
    expect(b480.laborMinutes - b480.overScheduledMinutes).toBe(480) // 所定内

    // 所定420に変更: labor540 → 所定内420 / 所定外120（境界が動く）
    const sb420 = mockClient({
      work_rules: [companyRule(420)],
      users: { daily_work_minutes: null },
      holiday_settings: [holiday()],
      japan_holidays: null,
    })
    const s420 = await resolveDayCalcSettings(sb420, args)
    const b420 = calcWorkTimeBreakdown({
      clockIn,
      clockOut,
      breakMinutes: 0,
      scheduledMinutes: s420.scheduledMinutes,
      dayType: s420.dayType,
    })
    expect(b420.overScheduledMinutes).toBe(120)
    expect(b420.laborMinutes - b420.overScheduledMinutes).toBe(420)
  })

  it('法定休日の曜日 → dayType=legal_holiday → holiday_minutes に集計', async () => {
    const sunArgs = { ...args, workDate: '2026-06-21' } // 日曜
    const sb = mockClient({
      work_rules: [companyRule(480)],
      users: { daily_work_minutes: null },
      holiday_settings: [holiday({ legal_holiday: 0 })],
      japan_holidays: null,
    })
    const r = await resolveDayCalcSettings(sb, sunArgs)
    expect(r.dayType).toBe('legal_holiday')
    const b = calcWorkTimeBreakdown({
      clockIn: new Date('2026-06-21T00:00:00.000Z'),
      clockOut: new Date('2026-06-21T08:00:00.000Z'),
      breakMinutes: 0,
      scheduledMinutes: r.scheduledMinutes,
      dayType: r.dayType,
    })
    expect(b.holidayMinutes).toBe(480)
  })

  it('祝日(平日)×所定休日扱い → scheduled_holiday', async () => {
    const sb = mockClient({
      work_rules: [companyRule(480)],
      users: { daily_work_minutes: null },
      holiday_settings: [holiday({ holiday_as: 'scheduled_holiday' })],
      japan_holidays: { holiday_date: '2026-06-23' },
    })
    const r = await resolveDayCalcSettings(sb, args)
    expect(r.dayType).toBe('scheduled_holiday')
  })

  it('設定行が無くても安全側既定（480/workday）', async () => {
    const sb = mockClient({ work_rules: [], users: null, holiday_settings: [], japan_holidays: null })
    const r = await resolveDayCalcSettings(sb, args)
    expect(r.scheduledMinutes).toBe(480)
    expect(r.dayType).toBe('workday')
  })
})
