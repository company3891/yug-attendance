import { describe, it, expect } from 'vitest'
import {
  resolveWorkRule,
  effectiveScheduledMinutes,
  type WorkRuleRow,
} from './workRules'

const COMPANY = 'c1'
const STORE = 's1'

const company = (from: string, min: number): WorkRuleRow => ({
  scope: 'company',
  company_id: COMPANY,
  store_id: null,
  effective_from: from,
  scheduled_minutes: min,
  work_start: '09:00',
  work_end: '18:00',
  break_minutes: 60,
})
const store = (from: string, min: number): WorkRuleRow => ({
  scope: 'store',
  company_id: COMPANY,
  store_id: STORE,
  effective_from: from,
  scheduled_minutes: min,
  work_start: '10:00',
  work_end: '19:00',
  break_minutes: 60,
})

describe('resolveWorkRule', () => {
  it('店舗上書きあり → 店舗の最新を優先', () => {
    const rows = [company('2020-01-01', 480), store('2026-01-01', 420)]
    const r = resolveWorkRule(rows, { date: '2026-06-01', storeId: STORE })
    expect(r?.scope).toBe('store')
    expect(r?.scheduled_minutes).toBe(420)
  })

  it('店舗上書きなし → 会社デフォルトにフォールバック', () => {
    const rows = [company('2020-01-01', 480)]
    const r = resolveWorkRule(rows, { date: '2026-06-01', storeId: STORE })
    expect(r?.scope).toBe('company')
    expect(r?.scheduled_minutes).toBe(480)
  })

  it('発効日境界: effective_from の前日は旧値、当日から新値', () => {
    const rows = [store('2020-01-01', 480), store('2026-06-01', 450)]
    expect(resolveWorkRule(rows, { date: '2026-05-31', storeId: STORE })?.scheduled_minutes).toBe(480)
    expect(resolveWorkRule(rows, { date: '2026-06-01', storeId: STORE })?.scheduled_minutes).toBe(450)
  })

  it('複数履歴から effective_from<=date の最新1件を選ぶ', () => {
    const rows = [
      store('2020-01-01', 480),
      store('2024-04-01', 460),
      store('2026-06-01', 450),
    ]
    expect(resolveWorkRule(rows, { date: '2025-12-31', storeId: STORE })?.scheduled_minutes).toBe(460)
  })

  it('別店舗の上書きは混ざらない（会社フォールバック）', () => {
    const rows = [company('2020-01-01', 480), { ...store('2026-01-01', 420), store_id: 'other' }]
    const r = resolveWorkRule(rows, { date: '2026-06-01', storeId: STORE })
    expect(r?.scope).toBe('company')
  })

  it('該当無し（未来の発効日のみ）→ null', () => {
    const rows = [store('2027-01-01', 420)]
    expect(resolveWorkRule(rows, { date: '2026-06-01', storeId: STORE })).toBeNull()
  })
})

describe('effectiveScheduledMinutes', () => {
  it('個人別上書きを優先', () => {
    expect(effectiveScheduledMinutes(store('2020-01-01', 480), 360)).toBe(360)
  })
  it('上書きなし → work_rule の値', () => {
    expect(effectiveScheduledMinutes(store('2020-01-01', 480), null)).toBe(480)
  })
  it('rule も上書きも無い → 既定480', () => {
    expect(effectiveScheduledMinutes(null, null)).toBe(480)
  })
  it('上書き0は無効として扱い work_rule 値', () => {
    expect(effectiveScheduledMinutes(store('2020-01-01', 480), 0)).toBe(480)
  })
})
