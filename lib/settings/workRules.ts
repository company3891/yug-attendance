/**
 * 就業設定（work_rules）の発効日つき解決（純関数・Phase 5）
 *
 * 「ある勤務日 D・ある店舗 S に有効な設定」＝
 *   store_id=S かつ effective_from <= D の最新行。
 *   無ければ会社デフォルト（scope='company' かつ effective_from <= D）の最新行にフォールバック。
 *
 * DBアクセスは行わず、対象会社の work_rules 行群を引数で受ける（テスト容易）。
 * 日付は 'YYYY-MM-DD' 文字列の辞書順比較＝時系列比較。
 */

export interface WorkRuleRow {
  scope: 'company' | 'store'
  company_id: string
  store_id: string | null
  effective_from: string // YYYY-MM-DD
  scheduled_minutes: number
  work_start: string | null
  work_end: string | null
  break_minutes: number
}

/** effective_from <= date の中で最新（effective_from 最大）の行を返す */
function latestEffective<T extends { effective_from: string }>(rows: T[], date: string): T | null {
  let best: T | null = null
  for (const r of rows) {
    if (r.effective_from <= date) {
      if (!best || r.effective_from > best.effective_from) best = r
    }
  }
  return best
}

/**
 * 勤務日 date・店舗 storeId に有効な work_rule を解決する。
 * 店舗上書きを優先し、無ければ会社デフォルトにフォールバック。該当無しは null。
 */
export function resolveWorkRule(
  rows: WorkRuleRow[],
  args: { date: string; storeId: string },
): WorkRuleRow | null {
  const storeRule = latestEffective(
    rows.filter((r) => r.scope === 'store' && r.store_id === args.storeId),
    args.date,
  )
  if (storeRule) return storeRule

  const companyRule = latestEffective(
    rows.filter((r) => r.scope === 'company'),
    args.date,
  )
  return companyRule
}

/**
 * 実効の所定労働時間（分）。個人別上書き（users.daily_work_minutes 由来）があれば優先、
 * 無ければ work_rule の scheduled_minutes。どちらも無ければ既定 480。
 */
export function effectiveScheduledMinutes(
  rule: WorkRuleRow | null,
  overrideMinutes: number | null | undefined,
): number {
  if (overrideMinutes != null && overrideMinutes > 0) return overrideMinutes
  return rule?.scheduled_minutes ?? 480
}
