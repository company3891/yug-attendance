/**
 * 給与単価履歴（user_wage_history）の発効日つき解決（純関数・Phase 5）
 *
 * 「勤務日 D に有効な単価・業務内容」＝ user_id=U かつ effective_from <= D の最新行。
 * DBアクセスは行わず、対象ユーザーの履歴行群を引数で受ける（テスト容易）。
 *
 * wage_type（時給/日給/月給）は users の現在値を使う（履歴対象外）。
 * 単価の最新行は users の現在値カラムへ同期し、レポート(lib/reports/*)は無改修で参照する。
 */

export interface WageHistoryRow {
  effective_from: string // YYYY-MM-DD
  unit_wage: number
  job_description: string | null
}

/** effective_from <= date の中で最新（同日複数は最後に現れたもの）の履歴を返す。該当無しは null */
export function resolveWage(rows: WageHistoryRow[], date: string): WageHistoryRow | null {
  let best: WageHistoryRow | null = null
  for (const r of rows) {
    if (r.effective_from <= date) {
      if (!best || r.effective_from >= best.effective_from) best = r
    }
  }
  return best
}

/** 履歴から「現在（最新発効日）」の単価行を返す。users 現在値カラム同期用。 */
export function latestWage(rows: WageHistoryRow[]): WageHistoryRow | null {
  let best: WageHistoryRow | null = null
  for (const r of rows) {
    if (!best || r.effective_from >= best.effective_from) best = r
  }
  return best
}
