import { createHmac, randomBytes } from 'node:crypto'

/**
 * 個人 QR コード ペイロード生成
 *
 * フォーマット: yug:v1:<store_id>:<user_id>:<qr_version>:<issued_at>:<sig>
 *
 * - HMAC-SHA256 で署名（key = stores.qr_secret）
 * - 署名は 128 bit (16 byte) に切り詰め → Base64URL 22文字
 * - 全体で約 150 byte → QR Version 7 以下に収まる
 * - 失効: qr_version インクリメント or qr_revoked_at 設定で旧 QR 無効化
 */

const PROTOCOL = 'yug:v1'

export interface QrPayload {
  store_id: string
  user_id: string
  qr_version: number
  issued_at: number // unix seconds
}

/**
 * 署名対象メッセージ（プロトコル + ペイロード）。
 */
function buildMessage(p: QrPayload): string {
  return `${PROTOCOL}:${p.store_id}:${p.user_id}:${p.qr_version}:${p.issued_at}`
}

/**
 * HMAC-SHA256(message, secret) の先頭16バイトを Base64URL 化。
 */
export function computeSignature(payload: QrPayload, qrSecret: string): string {
  const msg = buildMessage(payload)
  const hmac = createHmac('sha256', qrSecret).update(msg).digest()
  const truncated = hmac.subarray(0, 16) // 128bit
  return base64urlEncode(truncated)
}

/**
 * QR に書き込む文字列を生成する。
 *
 * @param payload  ペイロード
 * @param qrSecret 店舗の qr_secret（hex 文字列、32 byte 推奨）
 */
export function generateQrToken(payload: QrPayload, qrSecret: string): string {
  const sig = computeSignature(payload, qrSecret)
  return `${buildMessage(payload)}:${sig}`
}

/**
 * QR トークンをパースする（署名検証は別関数 verifier.ts で）。
 * 形式が不正なら null を返す。
 */
export function parseQrToken(
  token: string,
): { payload: QrPayload; signature: string } | null {
  const parts = token.split(':')
  // ['yug', 'v1', store_id, user_id, qr_version, issued_at, sig] = 7要素
  if (parts.length !== 7) return null
  if (parts[0] !== 'yug' || parts[1] !== 'v1') return null

  const [, , store_id, user_id, versionStr, issuedAtStr, signature] = parts
  if (!store_id || !user_id || !versionStr || !issuedAtStr || !signature) return null

  const qr_version = Number(versionStr)
  const issued_at = Number(issuedAtStr)
  if (!Number.isInteger(qr_version) || !Number.isInteger(issued_at)) return null

  return {
    payload: { store_id, user_id, qr_version, issued_at },
    signature,
  }
}

// ---------------------------------------------------------------------------
// Base64URL helpers (Node.js Buffer の base64url 出力。URL 安全 = / と + を _ - に)
// ---------------------------------------------------------------------------

export function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(s: string): Buffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/**
 * 32 byte のランダム hex を生成（stores.qr_secret 初期化用）。
 */
export function generateQrSecret(): string {
  return randomBytes(32).toString('hex')
}
