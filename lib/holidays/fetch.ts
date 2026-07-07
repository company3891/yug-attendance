/**
 * 内閣府「国民の祝日」CSV のネットワーク取得（サーバ専用・本番のみ実通信）
 *
 * ⚠️ 開発環境からは cao.go.jp へ接続できないため、この関数の実通信確認は
 *    本番（Vercel）デプロイ後にしか行えない。純ロジック（parse.ts）と分離しているのはそのため。
 *
 * Node ランタイム前提（global fetch + TextDecoder('shift_jis')）。Edge では動かさないこと。
 */

import { decodeShiftJis } from './parse'

export const CAO_HOLIDAY_CSV_URL =
  'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv'

/**
 * CSV を取得し Shift_JIS → UTF-8 に変換した文字列を返す。
 * 取得失敗（非2xx / ネットワークエラー）は例外を投げる（呼び出し側で握って中止・DB不変更）。
 */
export async function fetchHolidayCsv(url: string = CAO_HOLIDAY_CSV_URL): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`祝日CSVの取得に失敗しました: HTTP ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  return decodeShiftJis(buf)
}
