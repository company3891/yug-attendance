/**
 * GET /api/reports — 勤怠レポート出力（CSV / Excel）
 *
 * - 権限: admin 以上（employee 不可）。非master は自店舗に強制スコープ。
 * - フィルタ: year / month / store_id / user_id
 * - format=csv（Day2）/ excel（Day3）
 * - CSV: UTF-8 BOM + CRLF、Content-Disposition attachment、ファイル名に期間
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser, roleSatisfies } from '@/lib/auth/roles'
import { resolveVisibleScope, NO_MATCH_UUID } from '@/lib/permissions/scope'
import { reportQuerySchema } from '@/lib/schemas/report'
import { fetchReportRows } from '@/lib/reports/query'
import { buildCsv } from '@/lib/reports/csv'
import { buildReportWorkbook } from '@/lib/reports/excel'
import { contentDisposition } from '@/lib/reports/period'

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
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = reportQuerySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '入力が不正です', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const q = parsed.data

  const admin = createAdminClient()

  // --- 可視スコープ強制（master=全社 / 会社=自社全店 / 事業所=自店舗）---
  const scope = resolveVisibleScope(me)
  // スコープ内の店舗ID群を取得（事業所選択の検証 + 会社スコープのIN絞り込みに使用）
  let scopeStoreQuery = admin.from('stores').select('id')
  if (scope.kind === 'company') scopeStoreQuery = scopeStoreQuery.eq('company_id', scope.companyId)
  else if (scope.kind === 'store') scopeStoreQuery = scopeStoreQuery.eq('id', scope.storeId)
  else if (scope.kind !== 'all') scopeStoreQuery = scopeStoreQuery.eq('id', NO_MATCH_UUID)
  const { data: scopeStores } = await scopeStoreQuery
  const scopeStoreIds = ((scopeStores ?? []) as { id: string }[]).map((s) => s.id)

  // 事業所選択（スコープ内のみ有効。範囲外指定は無視）
  const selectedStoreId =
    q.store_id && (scope.kind === 'all' || scopeStoreIds.includes(q.store_id)) ? q.store_id : null
  // 絞り込み: 選択時=単一 / 会社スコープ未選択時=storeIds(IN) / 事業所=自店 / master未選択=全件
  const storeId = selectedStoreId ?? (scope.kind === 'store' ? scope.storeId : null)
  const storeIds = !storeId && scope.kind === 'company' ? scopeStoreIds : null

  let rows
  try {
    rows = await fetchReportRows(admin, {
      year: q.year,
      month: q.month,
      storeId,
      storeIds,
      userId: q.user_id ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message: `集計エラー: ${msg}` }, { status: 500 })
  }

  // --- Excel（見本準拠・人別シート）---
  if (q.format === 'excel') {
    const buffer = await buildReportWorkbook(rows, {
      year: q.year,
      month: q.month,
      clientName: q.client_name ?? '',
    })
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition(q.year, q.month, 'xlsx'),
        'Cache-Control': 'no-store',
      },
    })
  }

  // --- CSV（Day2）---
  const csv = buildCsv(rows)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDisposition(q.year, q.month, 'csv'),
      'Cache-Control': 'no-store',
    },
  })
}
