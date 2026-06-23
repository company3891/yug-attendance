import { describe, it, expect } from 'vitest'
import { fetchReportRows } from './query'

/**
 * Supabase クエリビルダの最小モック。
 * from→select→gte→lte→(eq)* を chain し、await で {data,error} を返す thenable。
 * select 文字列をキャプチャして、users 埋め込みの曖昧さ解消（制約名明示）を検証する。
 */
function makeFakeSupabase(rows: unknown[], capture: { select?: string }) {
  const builder: Record<string, unknown> = {}
  const ret = () => builder
  builder.select = (s: string) => {
    capture.select = s
    return builder
  }
  builder.gte = ret
  builder.lte = ret
  builder.eq = ret
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: rows, error: null })
  return { from: () => builder } as unknown as Parameters<typeof fetchReportRows>[0]
}

const wtc = {
  labor_minutes: 480,
  scheduled_minutes: 480,
  over_scheduled_minutes: 0,
  over_legal_minutes: 0,
  midnight_minutes: 0,
  midnight_over_minutes: 480,
  holiday_minutes: 0,
  holiday_over_minutes: 480,
}

const dbRows = [
  {
    user_id: 'u2',
    store_id: 's1',
    work_date: '2026-06-02',
    clock_in: '2026-06-02T00:00:00.000Z',
    clock_out: '2026-06-02T08:00:00.000Z',
    break_minutes: 0,
    users: { name: '佐藤花子', wage_type: 'hourly', hourly_wage: 1000, monthly_wage: null, daily_wage: null },
    stores: { name: '本店' },
    work_time_calculations: wtc,
  },
  {
    user_id: 'u1',
    store_id: 's1',
    work_date: '2026-06-01',
    clock_in: '2026-06-01T00:00:00.000Z',
    clock_out: '2026-06-01T08:00:00.000Z',
    break_minutes: 0,
    users: { name: '安藤一郎', wage_type: 'daily', hourly_wage: null, monthly_wage: null, daily_wage: 9000 },
    stores: { name: '本店' },
    work_time_calculations: wtc,
  },
]

describe('fetchReportRows', () => {
  it('成功して ReportRow[] が返る（行マッピング + 氏名→日付の整列）', async () => {
    const capture: { select?: string } = {}
    const sb = makeFakeSupabase(dbRows, capture)
    const rows = await fetchReportRows(sb, { year: 2026, month: 6, storeId: 's1', userId: null })

    expect(rows).toHaveLength(2)
    // 氏名(ja)順: 安藤 < 佐藤
    expect(rows[0]?.userName).toBe('安藤一郎')
    expect(rows[1]?.userName).toBe('佐藤花子')
    expect(rows[0]?.laborMinutes).toBe(480)
    expect(rows[0]?.wageType).toBe('daily')
    expect(rows[1]?.unitWage).toBe(1000)
  })

  it('users 埋め込みは制約名で曖昧さ解消している（PGRST201 回帰防止）', async () => {
    const capture: { select?: string } = {}
    const sb = makeFakeSupabase([], capture)
    await fetchReportRows(sb, { year: 2026, month: 6, storeId: null, userId: null })
    expect(capture.select).toContain('users!attendances_user_id_fkey(')
  })

  it('0件でも空配列を返す', async () => {
    const sb = makeFakeSupabase([], {})
    const rows = await fetchReportRows(sb, { year: 2026, month: 6, storeId: null, userId: null })
    expect(rows).toEqual([])
  })
})
