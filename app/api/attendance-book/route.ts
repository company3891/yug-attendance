/**
 * GET /api/attendance-book — 出勤簿 Excel 出力
 *
 * - 権限: admin 以上（employee 不可）。非master は可視スコープ（自社/自店）に強制。
 * - フィルタ: from / to（YYYY-MM）/ store_id / user_ids（複数）/ group_by
 * - 給与レポート（/api/reports）とは別機能。既存は一切変更しない。
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser, roleSatisfies } from '@/lib/auth/roles'
import { resolveVisibleScope, NO_MATCH_UUID } from '@/lib/permissions/scope'
import {
  attendanceBookQuerySchema,
  parseYearMonth,
  monthSpan,
  MAX_BOOK_MONTHS,
} from '@/lib/schemas/attendance-book'
import { fetchAttendanceBook } from '@/lib/attendance-book/query'
import { buildAttendanceBookWorkbook } from '@/lib/attendance-book/excel'
import { bookContentDisposition } from '@/lib/reports/period'

export async function GET(req: NextRequest) {
  // --- 認可 ---
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ ok: false, message: '未ログインです' }, { status: 401 })
  }
  if (!roleSatisfies(me.role, 'admin')) {
    return NextResponse.json({ ok: false, message: '権限がありません' }, { status: 403 })
  }

  // --- クエリ検証 ---
  const sp = req.nextUrl.searchParams
  const raw = Object.fromEntries(sp.entries())
  const parsed = attendanceBookQuerySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '入力が不正です', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const q = parsed.data
  const from = parseYearMonth(q.from)
  const to = parseYearMonth(q.to)
  const span = monthSpan(from, to)
  if (span === 0) {
    return NextResponse.json(
      { ok: false, message: '期間の開始が終了より後になっています' },
      { status: 400 },
    )
  }
  if (span > MAX_BOOK_MONTHS) {
    return NextResponse.json(
      { ok: false, message: `期間が長すぎます（最大 ${MAX_BOOK_MONTHS} ヶ月）` },
      { status: 400 },
    )
  }
  // user_ids は繰り返しパラメータ（getAll）で受ける
  const userIds = sp.getAll('user_ids').filter((v) => v.length > 0)

  const admin = createAdminClient()

  // --- 可視スコープ強制（master=全社 / 会社=自社全店 / 事業所=自店舗）---
  const scope = resolveVisibleScope(me)
  let scopeStoreQuery = admin.from('stores').select('id')
  if (scope.kind === 'company') scopeStoreQuery = scopeStoreQuery.eq('company_id', scope.companyId)
  else if (scope.kind === 'store') scopeStoreQuery = scopeStoreQuery.eq('id', scope.storeId)
  else if (scope.kind !== 'all') scopeStoreQuery = scopeStoreQuery.eq('id', NO_MATCH_UUID)
  const { data: scopeStores } = await scopeStoreQuery
  const scopeStoreIds = ((scopeStores ?? []) as { id: string }[]).map((s) => s.id)

  const selectedStoreId =
    q.store_id && (scope.kind === 'all' || scopeStoreIds.includes(q.store_id)) ? q.store_id : null
  const storeId = selectedStoreId ?? (scope.kind === 'store' ? scope.storeId : null)
  const storeIds = !storeId && scope.kind === 'company' ? scopeStoreIds : null

  let sheets
  try {
    sheets = await fetchAttendanceBook(admin, {
      from,
      to,
      storeId,
      storeIds,
      userIds,
      groupBy: q.group_by,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message: `出力エラー: ${msg}` }, { status: 500 })
  }

  const buffer = await buildAttendanceBookWorkbook(sheets)
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': bookContentDisposition(from, to),
      'Cache-Control': 'no-store',
    },
  })
}
