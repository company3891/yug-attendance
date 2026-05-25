/**
 * 打刻丸めユーティリティ（純関数）
 *
 * 仕様書 STEP 3-2「打刻丸めルール」:
 *   - 丸めなし / 15分単位 / 30分単位
 *   - 出勤時は切り上げ、退勤時は切り下げ（労働時間を短く見積もる方向）
 *
 * 設計判断:
 *   - 単位は数値の minutes（0=丸めなし, 15, 30）。将来 5/10/60 等への拡張容易
 *   - 方向は 'up' / 'down' のみ。'nearest' は労基観点でリスクがあるため非対応
 *   - 秒・ミリ秒は丸め後に 0 で正規化（DB保存時の比較を簡潔に）
 */

export type RoundingUnit = 0 | 15 | 30
export type RoundingDirection = 'up' | 'down'

/**
 * 打刻時刻を指定の単位/方向で丸める。
 *
 * @param time 丸める対象の時刻
 * @param unit 0=丸めなし / 15分 / 30分
 * @param direction 'up'=切り上げ（出勤打刻向け）/ 'down'=切り下げ（退勤打刻向け）
 */
export function roundClockTime(
  time: Date,
  unit: RoundingUnit,
  direction: RoundingDirection,
): Date {
  if (unit !== 0 && unit !== 15 && unit !== 30) {
    throw new Error(`Unsupported rounding unit: ${unit}`)
  }
  if (direction !== 'up' && direction !== 'down') {
    throw new Error(`Unsupported direction: ${direction}`)
  }
  if (unit === 0) {
    return new Date(time.getTime())
  }

  const out = new Date(time.getTime())
  // 秒・ミリ秒を 0 にして「分」基準で計算する
  const seconds = out.getSeconds()
  const ms = out.getMilliseconds()
  const hasSubMinute = seconds > 0 || ms > 0
  out.setSeconds(0, 0)

  const minutes = out.getMinutes()
  const remainder = minutes % unit

  if (direction === 'up') {
    if (remainder === 0 && !hasSubMinute) {
      // 境界ピッタリ → そのまま
      return out
    }
    // 切上げ: 次の単位境界へ
    const addMinutes = unit - remainder
    out.setMinutes(minutes + addMinutes)
  } else {
    // 切下げ: 直前の単位境界へ（境界ピッタリならそのまま）
    out.setMinutes(minutes - remainder)
  }
  return out
}
