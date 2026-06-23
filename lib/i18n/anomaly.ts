/**
 * 打刻異常コードの表示文言（CLAUDE.md「打刻異常コード一覧」と同期）
 *
 * 新コードを追加する際は CLAUDE.md の表 + lib/workTime.ts の AnomalyCode union と同時更新。
 */

export const ANOMALY_LABELS: Record<string, string> = {
  clock_out_before_in: '退勤が出勤より前',
  break_exceeds_work: '休憩が労働時間超過',
  duration_over_24h: '連続勤務24時間超',
  duplicate_clock: '連続打刻',
}

export function anomalyLabel(code: string): string {
  return ANOMALY_LABELS[code] ?? code
}
