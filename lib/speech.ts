/**
 * Web Speech API (SpeechSynthesis) のラッパー
 *
 * ブラウザの自動再生制限を考慮し、ユーザー操作後にのみ音声を発火する。
 * サポートされていないブラウザではサイレントにフォールバック。
 */

export type ClockEventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

/** 打刻種別 → 日本語フレーズ */
const CLOCK_MESSAGES: Record<ClockEventType, string> = {
  clock_in: 'さん、出勤しました',
  clock_out: 'さん、退勤しました',
  break_start: 'さん、休憩を開始しました',
  break_end: 'さん、休憩を終了しました',
}

/** 音声合成がサポートされているか */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * 打刻成功時に音声読み上げを発火する。
 *
 * @param lastName 姓（「杉本」など）— users.name の先頭スペース区切りの最初の部分
 * @param event    打刻イベント種別
 * @param enabled  音声ON/OFF（false または未設定なら無音）
 */
export function announceClock(
  lastName: string,
  event: ClockEventType,
  enabled: boolean = true,
): void {
  if (!enabled || !isSpeechSupported()) return

  const synth = window.speechSynthesis

  // 前の発話をキャンセル（連打時のスタック防止）
  synth.cancel()

  const text = `${lastName}${CLOCK_MESSAGES[event]}`
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = 1.0

  synth.speak(utterance)
}

/**
 * users.name（フルネーム「杉本 悠」）から姓を抽出する。
 * スペース区切りの先頭要素を返す。スペースがなければ全体を返す。
 */
export function extractLastName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName
}

/**
 * 音声読み上げを有効にするか判定する。
 * ユーザー設定（null = 未設定）→ 店舗設定 → デフォルト true の優先順で判定。
 */
export function resolveVoiceEnabled(
  userSetting: boolean | null | undefined,
  storeDefault: boolean | null | undefined,
): boolean {
  if (userSetting !== null && userSetting !== undefined) return userSetting
  if (storeDefault !== null && storeDefault !== undefined) return storeDefault
  return true
}
