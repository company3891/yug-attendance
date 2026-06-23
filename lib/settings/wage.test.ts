import { describe, it, expect } from 'vitest'
import { resolveWage, latestWage, type WageHistoryRow } from './wage'

const w = (from: string, unit: number, job = ''): WageHistoryRow => ({
  effective_from: from,
  unit_wage: unit,
  job_description: job,
})

describe('resolveWage', () => {
  it('発効日<=勤務日の最新1件', () => {
    const rows = [w('2020-01-01', 1000), w('2026-04-01', 1100), w('2026-10-01', 1200)]
    expect(resolveWage(rows, '2026-06-01')?.unit_wage).toBe(1100)
  })

  it('発効日境界: 前日は旧単価、当日から新単価', () => {
    const rows = [w('2020-01-01', 1000), w('2026-04-01', 1100)]
    expect(resolveWage(rows, '2026-03-31')?.unit_wage).toBe(1000)
    expect(resolveWage(rows, '2026-04-01')?.unit_wage).toBe(1100)
  })

  it('全て未来の発効日 → null', () => {
    expect(resolveWage([w('2027-01-01', 1300)], '2026-06-01')).toBeNull()
  })

  it('空配列 → null', () => {
    expect(resolveWage([], '2026-06-01')).toBeNull()
  })

  it('業務内容も一緒に解決される', () => {
    const rows = [w('2020-01-01', 1000, 'ホール'), w('2026-04-01', 1100, 'キッチン')]
    expect(resolveWage(rows, '2026-06-01')?.job_description).toBe('キッチン')
  })
})

describe('latestWage', () => {
  it('最新発効日の行（users 現在値同期用）', () => {
    const rows = [w('2020-01-01', 1000), w('2026-10-01', 1200), w('2026-04-01', 1100)]
    expect(latestWage(rows)?.unit_wage).toBe(1200)
  })
  it('空配列 → null', () => {
    expect(latestWage([])).toBeNull()
  })
})
