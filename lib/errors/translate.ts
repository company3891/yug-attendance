/**
 * アプリ全体のエラーコード → 日本語メッセージ変換。
 *
 * Server Action / API ルートが返す構造化エラー:
 *   { ok: false, code: 'XXX', message: '...' }
 * のうち message を生成する一元辞書。
 *
 * 新しいエラーコードを追加する際は、必ず本ファイルにメッセージを追加すること。
 * 未登録コードは fallback で「予期しないエラーが発生しました」を返す。
 */

// ---------------------------------------------------------------------------
// エラーコード一覧（Phase 2 着手時点）
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  // 打刻関連
  CLOCK_TOO_FREQUENT: '前回の打刻から間もないため受け付けられません。1分以上空けて再度お試しください。',
  CLOCK_ALREADY_CLOSED:
    '本日の出退勤は記録済みです。\n外出打刻機能はPhase 10で実装予定です。\n修正が必要な場合は管理者にご相談ください。',
  CLOCK_OUT_BEFORE_IN: '退勤時刻が出勤時刻より前になっています。',

  // QR関連
  QR_INVALID_FORMAT: 'QRコードの形式が正しくありません。',
  QR_INVALID_SIGNATURE: 'QRコードの署名が一致しません。再発行を依頼してください。',
  QR_REVOKED: 'このQRコードは失効しています。新しいQRコードを管理者から受け取ってください。',
  QR_VERSION_MISMATCH: '古いバージョンのQRコードです。最新のQRコードを使用してください。',

  // ユーザー・店舗関連
  USER_NOT_FOUND: '従業員が見つかりません。',
  USER_INACTIVE: 'このアカウントは無効化されています。管理者にご連絡ください。',
  STORE_MISMATCH: 'この端末では別の店舗のQRコードは使用できません。',

  // 認可
  UNAUTHORIZED: 'ログインが必要です。',
  FORBIDDEN: 'この操作を行う権限がありません。',

  // 内部
  INTERNAL_ERROR: '予期しないエラーが発生しました。時間をおいて再度お試しください。',
  VALIDATION_FAILED: '入力内容に問題があります。',
} as const

export type ErrorCode = keyof typeof ERROR_CODES

/**
 * エラーコードを日本語メッセージに変換する。
 * 未登録なら INTERNAL_ERROR のメッセージを返す。
 */
export function translateError(code: ErrorCode | string): string {
  if (code in ERROR_CODES) return ERROR_CODES[code as ErrorCode]
  return ERROR_CODES.INTERNAL_ERROR
}

/**
 * 構造化エラーレスポンスを組み立てる。Server Action / API 共通。
 */
export interface ErrorResponse {
  ok: false
  code: ErrorCode
  message: string
}

export function errorResponse(code: ErrorCode, customMessage?: string): ErrorResponse {
  return {
    ok: false,
    code,
    message: customMessage ?? translateError(code),
  }
}
