/**
 * レポート用データ取得（サーバ専用）
 *
 * attendances + users(給与情報) + stores(名前) + work_time_calculations(8項目) を結合し、
 * buildReportRow() で ReportRow[] に変換する。CSV/Excel 双方から再利用する。
 *
 * 注意: 店舗スコープ（非masterは自店固定）は呼び出し側が filter.storeId で強制すること。
 */

import type { createAdminClient } from '@/lib/supabase/server'
import { buildReportRow, type ReportRow, type WageType, type WtcMinutes } from './build'
import { monthRange } from './period'

/** lib/supabase/server の createServerClient<Database> の戻り型に揃える（ジェネリック差異を吸収） */
type ReportSupabaseClient = ReturnType<typeof createAdminClient>

export interface ReportFilter {
  year: number
  month: number
  storeId: string | null // 単一事業所に絞る場合（選択時）
  /** 可視スコープが複数店舗（会社スコープ）の場合の許可店舗群。storeId 未指定時に IN で絞る */
  storeIds?: string[] | null
  userId: string | null
}

interface JoinedRow {
  user_id: string
  store_id: string
  work_date: string
  clock_in: string | null
  clock_out: string | null
  break_minutes: number | null
  users:
    | {
        name: string
        wage_type: string | null
        hourly_wage: number | null
        monthly_wage: number | null
        daily_wage: number | null
      }
    | Array<{
        name: string
        wage_type: string | null
        hourly_wage: number | null
        monthly_wage: number | null
        daily_wage: number | null
      }>
    | null
  stores: { name: string } | { name: string }[] | null
  work_time_calculations: WtcMinutes | WtcMinutes[] | null
}

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function asWageType(v: string | null): WageType | null {
  return v === 'hourly' || v === 'monthly' || v === 'daily' ? v : null
}

export async function fetchReportRows(
  supabase: ReportSupabaseClient,
  filter: ReportFilter,
): Promise<ReportRow[]> {
  const { start, end } = monthRange(filter.year, filter.month)

  let query = supabase
    .from('attendances')
    .select(
      // attendances→users は user_id / modified_by の2本のFKがあり曖昧（PGRST201）。
      // レポートは打刻者本人を出すので user_id のFK(attendances_user_id_fkey)を制約名で明示。
      'user_id, store_id, work_date, clock_in, clock_out, break_minutes, ' +
        'users!attendances_user_id_fkey(name, wage_type, hourly_wage, monthly_wage, daily_wage), ' +
        'stores(name), ' +
        'work_time_calculations(labor_minutes, scheduled_minutes, over_scheduled_minutes, over_legal_minutes, midnight_minutes, midnight_over_minutes, holiday_minutes, holiday_over_minutes)',
    )
    .gte('work_date', start)
    .lte('work_date', end)

  // 事業所選択時は単一、未選択かつ会社スコープ時は許可店舗群（IN）で絞る
  if (filter.storeId) query = query.eq('store_id', filter.storeId)
  else if (filter.storeIds) query = query.in('store_id', filter.storeIds.length ? filter.storeIds : ['00000000-0000-0000-0000-000000000000'])
  if (filter.userId) query = query.eq('user_id', filter.userId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows: ReportRow[] = (data as unknown as JoinedRow[]).map((r) => {
    const u = one(r.users)
    return buildReportRow({
      userId: r.user_id,
      userName: u?.name ?? '(不明)',
      storeName: one(r.stores)?.name ?? '(不明)',
      workDate: r.work_date,
      clockIn: r.clock_in,
      clockOut: r.clock_out,
      breakMinutes: r.break_minutes ?? 0,
      wtc: one(r.work_time_calculations),
      wageType: asWageType(u?.wage_type ?? null),
      hourlyWage: u?.hourly_wage ?? null,
      monthlyWage: u?.monthly_wage ?? null,
      dailyWage: u?.daily_wage ?? null,
    })
  })

  // 従業員名 → 勤務日 の順に整列（Excel のシート分け・人別集計に都合がよい）
  rows.sort((a, b) => {
    if (a.userName !== b.userName) return a.userName.localeCompare(b.userName, 'ja')
    return a.workDate.localeCompare(b.workDate)
  })

  return rows
}
