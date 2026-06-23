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

  // --- 店舗スコープ強制（非master は自店固定）---
  const effectiveStoreId = me.role === 'master' ? (q.store_id ?? null) : (me.store_id ?? null)

  const admin = createAdminClient()
  let rows
  try {
    rows = await fetchReportRows(admin, {
      year: q.year,
      month: q.month,
      storeId: effectiveStoreId,
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
