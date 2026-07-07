/**
 * 出勤簿データ取得（サーバ専用）
 *
 * 選択された従業員（可視スコープ内）のヘッダー情報を users から取得し、期間内の勤怠を
 * attendances + work_time_calculations(8項目) から取得。buildReportRow() で区分計算を再利用し、
 * 「従業員 × 月」ごとの AttendanceBookSheet[] を組み立てる。
 *
 * 打刻が1件も無い従業員・月でも、その月の全日を「－」で並べたシートを生成する
 * （出勤簿は選択従業員ぶん必ず出す）。
 *
 * スコープ強制（storeId / storeIds）は呼び出し側（route / page）が既存 resolveVisibleScope から渡す。
 */

import type { createAdminClient } from '@/lib/supabase/server'
import { NO_MATCH_UUID } from '@/lib/permissions/scope'
import { buildReportRow, type WtcMinutes } from '@/lib/reports/build'
import { eachMonthInRange, type YearMonth } from '@/lib/reports/period'
import {
  buildAttendanceBookSheet,
  type AttendanceBookHeader,
  type AttendanceBookSheet,
  type BookDailySource,
} from './layout'

type BookSupabaseClient = ReturnType<typeof createAdminClient>

export type BookGroupBy = 'person' | 'store' | 'company'

export interface BookFilter {
  from: YearMonth
  to: YearMonth
  /** 単一事業所に絞る場合 */
  storeId: string | null
  /** 会社スコープ時の許可店舗群（storeId 未指定時に IN で絞る） */
  storeIds?: string[] | null
  /** 選択された従業員ID群（空なら可視スコープ内の全員） */
  userIds: string[]
  /** シートの並び順（人単位 / 事業所→人 / 会社→事業所→人） */
  groupBy: BookGroupBy
}

interface UserHeaderRow {
  id: string
  name: string
  employee_no: string | null
  job_title: string | null
  companies: { name: string } | { name: string }[] | null
  stores: { name: string } | { name: string }[] | null
}

interface JoinedAttendance {
  user_id: string
  work_date: string
  clock_in: string | null
  clock_out: string | null
  break_minutes: number | null
  stores: { name: string } | { name: string }[] | null
  work_time_calculations: WtcMinutes | WtcMinutes[] | null
}

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

interface UserInfo {
  id: string
  name: string
  employeeNo: string | null
  jobTitle: string | null
  storeName: string
  companyName: string
}

export async function fetchAttendanceBook(
  supabase: BookSupabaseClient,
  filter: BookFilter,
): Promise<AttendanceBookSheet[]> {
  const months = eachMonthInRange(filter.from, filter.to)
  if (months.length === 0) return []

  // --- 1. 対象従業員（ヘッダー情報 + スコープ絞り込み） ---
  let uq = supabase
    .from('users')
    .select('id, name, employee_no, job_title, companies(name), stores(name)')
    .order('name')
  if (filter.storeId) uq = uq.eq('store_id', filter.storeId)
  else if (filter.storeIds)
    uq = uq.in('store_id', filter.storeIds.length ? filter.storeIds : [NO_MATCH_UUID])
  if (filter.userIds.length) uq = uq.in('id', filter.userIds)

  const { data: uData, error: uErr } = await uq
  if (uErr) throw new Error(uErr.message)

  const users: UserInfo[] = ((uData ?? []) as unknown as UserHeaderRow[]).map((u) => ({
    id: u.id,
    name: u.name,
    employeeNo: u.employee_no,
    jobTitle: u.job_title,
    storeName: one(u.stores)?.name ?? '－',
    companyName: one(u.companies)?.name ?? '－',
  }))
  if (users.length === 0) return []

  // --- 2. 期間内の勤怠（対象従業員ぶん） ---
  const first = months[0]!
  const last = months[months.length - 1]!
  const rangeStart = `${first.year}-${pad(first.month)}-01`
  const lastDay = new Date(last.year, last.month, 0).getDate()
  const rangeEnd = `${last.year}-${pad(last.month)}-${pad(lastDay)}`

  const { data: aData, error: aErr } = await supabase
    .from('attendances')
    .select(
      // attendances→users は user_id / modified_by の2本のFKがあり曖昧。ここは user_id で絞るだけなので join 不要。
      'user_id, work_date, clock_in, clock_out, break_minutes, ' +
        'stores(name), ' +
        'work_time_calculations(labor_minutes, scheduled_minutes, over_scheduled_minutes, over_legal_minutes, midnight_minutes, midnight_over_minutes, holiday_minutes, holiday_over_minutes)',
    )
    .gte('work_date', rangeStart)
    .lte('work_date', rangeEnd)
    .in(
      'user_id',
      users.map((u) => u.id),
    )
  if (aErr) throw new Error(aErr.message)

  // userId → BookDailySource[]（区分計算は buildReportRow を再利用。給与情報は出勤簿では未使用→null） ---
  const byUser = new Map<string, BookDailySource[]>()
  for (const r of (aData ?? []) as unknown as JoinedAttendance[]) {
    const info = users.find((u) => u.id === r.user_id)
    const base = buildReportRow({
      userId: r.user_id,
      userName: info?.name ?? '(不明)',
      storeName: one(r.stores)?.name ?? '－',
      workDate: r.work_date,
      clockIn: r.clock_in,
      clockOut: r.clock_out,
      breakMinutes: r.break_minutes ?? 0,
      wtc: one(r.work_time_calculations),
      wageType: null,
      hourlyWage: null,
      monthlyWage: null,
      dailyWage: null,
    })
    const src: BookDailySource = { ...base, breakMinutes: r.break_minutes ?? 0 }
    const list = byUser.get(r.user_id)
    if (list) list.push(src)
    else byUser.set(r.user_id, [src])
  }

  // --- 3. 並び順（groupBy） ---
  const ordered = [...users].sort((a, b) => {
    if (filter.groupBy === 'company' && a.companyName !== b.companyName)
      return a.companyName.localeCompare(b.companyName, 'ja')
    if (filter.groupBy !== 'person' && a.storeName !== b.storeName)
      return a.storeName.localeCompare(b.storeName, 'ja')
    return a.name.localeCompare(b.name, 'ja')
  })

  // --- 4. 従業員 × 月 でシート生成 ---
  const sheets: AttendanceBookSheet[] = []
  for (const u of ordered) {
    const userRows = byUser.get(u.id) ?? []
    for (const ym of months) {
      const prefix = `${ym.year}-${pad(ym.month)}-`
      const rows = userRows.filter((r) => r.workDate.startsWith(prefix))
      const header: AttendanceBookHeader = {
        companyName: u.companyName,
        storeName: u.storeName,
        employeeName: u.name,
        employeeNo: u.employeeNo,
        jobTitle: u.jobTitle,
        year: ym.year,
        month: ym.month,
      }
      sheets.push(buildAttendanceBookSheet(header, rows))
    }
  }

  return sheets
}
