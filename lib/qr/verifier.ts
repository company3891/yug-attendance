import { timingSafeEqual } from 'node:crypto'
import {
  base64urlDecode,
  computeSignature,
  parseQrToken,
  type QrPayload,
} from './generator'

/**
 * QR 検証ロジック
 *
 * 純粋な「署名照合」と「ビジネス検証」を分離してテスト容易性を確保。
 * ビジネス検証（qr_version / qr_revoked_at / is_active / store_id 等）は
 * DB から取得した user/store レコードを引数に取る純関数として実装。
 */

// ---------------------------------------------------------------------------
// 結果型
// ---------------------------------------------------------------------------

export type VerifyResult =
  | { ok: true; payload: QrPayload }
  | { ok: false; code: VerifyErrorCode }

export type VerifyErrorCode =
  | 'QR_INVALID_FORMAT'
  | 'QR_INVALID_SIGNATURE'
  | 'QR_REVOKED'
  | 'QR_VERSION_MISMATCH'
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'STORE_MISMATCH'

// ビジネス検証で渡す user/store の最小スナップショット
export interface UserSnapshot {
  id: string
  store_id: string | null
  is_active: boolean
  qr_version: number
  qr_revoked_at: string | null  // ISO8601 or null
  qr_issued_at: string | null
}

export interface StoreSnapshot {
  id: string
  qr_secret: string
}

// ---------------------------------------------------------------------------
// Step 1: 署名検証（純関数、定数時間比較）
// ---------------------------------------------------------------------------

/**
 * QR トークンの形式チェック + HMAC 署名検証。
 * - timingSafeEqual で定数時間比較（タイムアタック対策）
 * - 失敗時は QR_INVALID_FORMAT / QR_INVALID_SIGNATURE を返す
 *
 * @param token  QR コードに書き込まれた文字列
 * @param qrSecret 検証対象の store.qr_secret
 */
export function verifyQrSignature(token: string, qrSecret: string): VerifyResult {
  const parsed = parseQrToken(token)
  if (!parsed) return { ok: false, code: 'QR_INVALID_FORMAT' }

  const expected = computeSignature(parsed.payload, qrSecret)
  const expectedBuf = base64urlDecode(expected)
  const actualBuf = base64urlDecode(parsed.signature)

  // 長さが違う時点で不一致（timingSafeEqual は同長必須）
  if (expectedBuf.length !== actualBuf.length) {
    return { ok: false, code: 'QR_INVALID_SIGNATURE' }
  }

  try {
    if (!timingSafeEqual(expectedBuf, actualBuf)) {
      return { ok: false, code: 'QR_INVALID_SIGNATURE' }
    }
  } catch {
    return { ok: false, code: 'QR_INVALID_SIGNATURE' }
  }

  return { ok: true, payload: parsed.payload }
}

// ---------------------------------------------------------------------------
// Step 2: ビジネス検証（純関数、DB スナップショットを引数に取る）
// ---------------------------------------------------------------------------

/**
 * 署名済みペイロードに対して、user/store の状態を見てビジネスルールを検証する。
 *
 * 仕様判断 (Phase 2):
 *   - QR は基本「無期限」。失効は qr_revoked_at / qr_version / is_active の3点で制御。
 *   - 発行から 3 年経過 = ハード期限ではなく「更新推奨バッジ」(別関数 isQrUpdateRecommended)
 *     で運用上の注意喚起のみ行う。長期勤続パート従業員が突然打刻不能になる事故を避けるため。
 *
 * 検証順:
 *   1. user の存在 / id 一致
 *   2. user.is_active = true
 *   3. user.store_id == payload.store_id（他店舗QR拒否）
 *   4. store.id == payload.store_id（端末の店舗と一致）
 *   5. user.qr_revoked_at が null（失効済みでない）
 *   6. user.qr_version === payload.qr_version（旧 QR 拒否）
 */
export function verifyBusinessRules(
  payload: QrPayload,
  user: UserSnapshot | null,
  store: StoreSnapshot,
): VerifyResult {
  if (!user) return { ok: false, code: 'USER_NOT_FOUND' }
  if (user.id !== payload.user_id) return { ok: false, code: 'USER_NOT_FOUND' }
  if (!user.is_active) return { ok: false, code: 'USER_INACTIVE' }
  if (user.store_id !== payload.store_id) return { ok: false, code: 'STORE_MISMATCH' }
  if (store.id !== payload.store_id) return { ok: false, code: 'STORE_MISMATCH' }
  if (user.qr_revoked_at !== null) return { ok: false, code: 'QR_REVOKED' }
  if (user.qr_version !== payload.qr_version) {
    return { ok: false, code: 'QR_VERSION_MISMATCH' }
  }
  return { ok: true, payload }
}

/**
 * QR の更新推奨判定（警告バッジ用）。
 * 「発行から指定年数 (既定 3 年) 経過しているか」を返す。
 * これ自体は打刻可否に影響せず、UI で「QR更新推奨」バッジを出す目的のみ。
 *
 * @param qrIssuedAt users.qr_issued_at (ISO8601 or null)
 * @param options.now / options.recommendedYears
 */
export function isQrUpdateRecommended(
  qrIssuedAt: string | null,
  options: { now?: Date; recommendedYears?: number } = {},
): boolean {
  if (!qrIssuedAt) return false
  const issuedMs = new Date(qrIssuedAt).getTime()
  if (Number.isNaN(issuedMs)) return false
  const years = options.recommendedYears ?? 3
  const now = options.now ?? new Date()
  const elapsedMs = now.getTime() - issuedMs
  return elapsedMs > years * 365 * 24 * 60 * 60 * 1000
}

// ---------------------------------------------------------------------------
// Step 3: 統合検証（署名 + ビジネス）
// ---------------------------------------------------------------------------

export function verifyQr(
  token: string,
  store: StoreSnapshot,
  fetchUser: (userId: string) => UserSnapshot | null,
): VerifyResult {
  const sigResult = verifyQrSignature(token, store.qr_secret)
  if (!sigResult.ok) return sigResult

  const user = fetchUser(sigResult.payload.user_id)
  return verifyBusinessRules(sigResult.payload, user, store)
}
