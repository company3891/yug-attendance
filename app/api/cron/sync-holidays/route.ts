/**
 * GET /api/cron/sync-holidays — 祝日マスタ(japan_holidays)の年次自動更新
 *
 * Vercel Cron から毎年2月1日に実行（vercel.json の crons）。
 * 内閣府公式CSVを取得 → パース → japan_holidays へ upsert（冪等・非破壊）。
 *
 * 認証: CRON_SECRET（Vercel Cron が Authorization: Bearer $CRON_SECRET を自動付与）。
 *   - 未設定 → 500（構成ミス） / 不一致 → 401（外部・無認証実行を拒否）
 * 非破壊: CSVに無い過去データは削除しない。パース0件なら中止（誤ってDBを空にしない）。
 * 記録: 取り込み件数・対象年範囲・実行日時をサーバログ + audit_logs(system.holidays_sync) に残す。
 *
 * ⚠️ CSV の実取得は本番のみ（開発環境から cao.go.jp へ接続不可）。詳細は docs/holidays-sync.md。
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchHolidayCsv } from '@/lib/holidays/fetch'
import { parseHolidayCsv, summarizeHolidays } from '@/lib/holidays/parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // --- 認証（CRON_SECRET）---
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: 'CRON_SECRET が未設定です（Vercel の環境変数を確認してください）' },
      { status: 500 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: '認証に失敗しました' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()

  // --- 取得（本番のみ実通信）---
  let csv: string
  try {
    csv = await fetchHolidayCsv()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[sync-holidays] fetch failed: ${msg}`)
    return NextResponse.json({ ok: false, message: `取得エラー: ${msg}` }, { status: 502 })
  }

  // --- パース ---
  const rows = parseHolidayCsv(csv)
  const summary = summarizeHolidays(rows)
  if (rows.length === 0) {
    // CSV 破損等で 0 件のとき、既存データを消さないよう upsert せず中止
    console.error('[sync-holidays] parsed 0 rows — abort (no DB change)')
    return NextResponse.json(
      { ok: false, message: 'CSVから有効な祝日が0件でした（取込中止・DBは変更なし）' },
      { status: 422 },
    )
  }

  // --- upsert（冪等・非破壊）---
  const admin = createAdminClient()
  // 既存コード同様、Supabase 生成型の insert/upsert 型（never 化）に合わせて as never キャスト
  const { error } = await admin
    .from('japan_holidays')
    .upsert(rows as never, { onConflict: 'holiday_date' })
  if (error) {
    console.error(`[sync-holidays] upsert failed: ${error.message}`)
    return NextResponse.json({ ok: false, message: `DB更新エラー: ${error.message}` }, { status: 500 })
  }

  const finishedAt = new Date().toISOString()

  // --- 記録（audit_logs は best-effort。失敗しても本処理は成功扱い）---
  await admin
    .from('audit_logs')
    .insert({
      actor_id: null,
      action: 'system.holidays_sync',
      resource_type: 'japan_holidays',
      resource_id: null,
      after_data: {
        count: summary.count,
        minYear: summary.minYear,
        maxYear: summary.maxYear,
        startedAt,
        finishedAt,
        source: 'cao.go.jp',
      },
    } as never)
    .then(
      () => {},
      (e: unknown) => {
        const m = e instanceof Error ? e.message : String(e)
        console.error(`[sync-holidays] audit insert failed (ignored): ${m}`)
      },
    )

  console.log(
    `[sync-holidays] upserted ${summary.count} holidays ` +
      `(${summary.minYear}-${summary.maxYear}) finished ${finishedAt}`,
  )

  return NextResponse.json({ ok: true, ...summary, startedAt, finishedAt })
}
