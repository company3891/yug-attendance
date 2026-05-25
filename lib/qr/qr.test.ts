import { describe, it, expect } from 'vitest'
import {
  generateQrToken,
  parseQrToken,
  computeSignature,
  generateQrSecret,
  base64urlEncode,
  base64urlDecode,
  type QrPayload,
} from './generator'
import {
  verifyQrSignature,
  verifyBusinessRules,
  verifyQr,
  isQrUpdateRecommended,
  type UserSnapshot,
  type StoreSnapshot,
} from './verifier'

const STORE_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '2b1c4510-c814-4f74-aadf-d1d56b8e1d92'
const QR_SECRET = 'a'.repeat(64) // 32 byte hex
const OTHER_SECRET = 'b'.repeat(64)

const payload: QrPayload = {
  store_id: STORE_ID,
  user_id: USER_ID,
  qr_version: 1,
  issued_at: 1748000000,
}

const baseUser: UserSnapshot = {
  id: USER_ID,
  store_id: STORE_ID,
  is_active: true,
  qr_version: 1,
  qr_revoked_at: null,
  qr_issued_at: '2026-05-23T00:00:00Z',
}

const baseStore: StoreSnapshot = { id: STORE_ID, qr_secret: QR_SECRET }

// ─────────────────────────────────────────
// 生成 / パース
// ─────────────────────────────────────────
describe('generateQrToken / parseQrToken', () => {
  it('生成 → パースで元のペイロードに戻る', () => {
    const token = generateQrToken(payload, QR_SECRET)
    const parsed = parseQrToken(token)
    expect(parsed).not.toBeNull()
    expect(parsed!.payload).toEqual(payload)
    expect(parsed!.signature.length).toBeGreaterThan(0)
  })

  it('プロトコル文字列が含まれる', () => {
    expect(generateQrToken(payload, QR_SECRET)).toMatch(/^yug:v1:/)
  })

  it('短すぎるトークン → null', () => {
    expect(parseQrToken('abc')).toBeNull()
  })

  it('プロトコル違い → null', () => {
    expect(parseQrToken(`bad:v1:${STORE_ID}:${USER_ID}:1:1748000000:xxx`)).toBeNull()
  })

  it('数値以外のバージョン → null', () => {
    expect(parseQrToken(`yug:v1:${STORE_ID}:${USER_ID}:abc:1748000000:xxx`)).toBeNull()
  })

  it('数値以外のissued_at → null', () => {
    expect(parseQrToken(`yug:v1:${STORE_ID}:${USER_ID}:1:NaT:xxx`)).toBeNull()
  })

  it('空フィールド → null', () => {
    expect(parseQrToken(`yug:v1::${USER_ID}:1:1748000000:xxx`)).toBeNull()
  })
})

// ─────────────────────────────────────────
// 署名検証（純粋暗号レイヤ）
// ─────────────────────────────────────────
describe('verifyQrSignature', () => {
  it('正規トークン → ok', () => {
    const token = generateQrToken(payload, QR_SECRET)
    const r = verifyQrSignature(token, QR_SECRET)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload).toEqual(payload)
  })

  it('別 secret → QR_INVALID_SIGNATURE', () => {
    const token = generateQrToken(payload, QR_SECRET)
    const r = verifyQrSignature(token, OTHER_SECRET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_INVALID_SIGNATURE')
  })

  it('ペイロード改ざん (user_id) → QR_INVALID_SIGNATURE', () => {
    const token = generateQrToken(payload, QR_SECRET)
    const parts = token.split(':')
    parts[3] = 'tampered-id-tampered-id-tampered-1234'
    const r = verifyQrSignature(parts.join(':'), QR_SECRET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_INVALID_SIGNATURE')
  })

  it('署名部分の長さ違い → QR_INVALID_SIGNATURE', () => {
    const token = generateQrToken(payload, QR_SECRET)
    const parts = token.split(':')
    parts[6] = 'AA' // 短い署名
    const r = verifyQrSignature(parts.join(':'), QR_SECRET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_INVALID_SIGNATURE')
  })

  it('壊れた Base64URL → QR_INVALID_SIGNATURE', () => {
    const parts = generateQrToken(payload, QR_SECRET).split(':')
    parts[6] = '@@@invalid@@@'
    const r = verifyQrSignature(parts.join(':'), QR_SECRET)
    expect(r.ok).toBe(false)
  })

  it('フォーマット不正 → QR_INVALID_FORMAT', () => {
    const r = verifyQrSignature('not a qr token', QR_SECRET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_INVALID_FORMAT')
  })
})

// ─────────────────────────────────────────
// ビジネス検証
// ─────────────────────────────────────────
describe('verifyBusinessRules', () => {
  it('全条件OK → ok', () => {
    const r = verifyBusinessRules(payload, baseUser, baseStore)
    expect(r.ok).toBe(true)
  })

  it('user が null → USER_NOT_FOUND', () => {
    const r = verifyBusinessRules(payload, null, baseStore)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('USER_NOT_FOUND')
  })

  it('user.id 不一致 → USER_NOT_FOUND', () => {
    const r = verifyBusinessRules(payload, { ...baseUser, id: 'different-uuid' }, baseStore)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('USER_NOT_FOUND')
  })

  it('is_active=false → USER_INACTIVE', () => {
    const r = verifyBusinessRules(payload, { ...baseUser, is_active: false }, baseStore)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('USER_INACTIVE')
  })

  it('user.store_id 不一致 → STORE_MISMATCH', () => {
    const r = verifyBusinessRules(
      payload,
      { ...baseUser, store_id: 'other-store-id' },
      baseStore,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('STORE_MISMATCH')
  })

  it('打刻端末の store と payload.store 不一致 → STORE_MISMATCH', () => {
    const r = verifyBusinessRules(payload, baseUser, {
      id: 'other-store-id',
      qr_secret: QR_SECRET,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('STORE_MISMATCH')
  })

  it('qr_revoked_at が設定済 → QR_REVOKED', () => {
    const r = verifyBusinessRules(
      payload,
      { ...baseUser, qr_revoked_at: '2026-05-25T10:00:00Z' },
      baseStore,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_REVOKED')
  })

  it('qr_version が古い (payload=1, user=2) → QR_VERSION_MISMATCH', () => {
    const r = verifyBusinessRules(payload, { ...baseUser, qr_version: 2 }, baseStore)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_VERSION_MISMATCH')
  })

  it('3年超でも打刻可（ハード期限なし、警告のみ）', () => {
    // 案C: QR_EXPIRED は廃止、isQrUpdateRecommended で警告表示する運用
    const r = verifyBusinessRules(payload, baseUser, baseStore)
    expect(r.ok).toBe(true)
  })
})

describe('isQrUpdateRecommended (警告バッジ判定)', () => {
  it('qr_issued_at = null → false (未発行)', () => {
    expect(isQrUpdateRecommended(null)).toBe(false)
  })

  it('発行直後 → false', () => {
    expect(
      isQrUpdateRecommended('2026-05-01T00:00:00Z', { now: new Date('2026-05-23T00:00:00Z') }),
    ).toBe(false)
  })

  it('発行から3年未満 → false', () => {
    expect(
      isQrUpdateRecommended('2026-01-01T00:00:00Z', { now: new Date('2028-12-31T00:00:00Z') }),
    ).toBe(false)
  })

  it('発行から3年超 → true (更新推奨バッジ)', () => {
    expect(
      isQrUpdateRecommended('2023-01-01T00:00:00Z', { now: new Date('2026-05-01T00:00:00Z') }),
    ).toBe(true)
  })

  it('recommendedYears=5 で5年未満 → false', () => {
    expect(
      isQrUpdateRecommended('2023-01-01T00:00:00Z', {
        now: new Date('2026-05-01T00:00:00Z'),
        recommendedYears: 5,
      }),
    ).toBe(false)
  })

  it('不正な日付文字列 → false', () => {
    expect(isQrUpdateRecommended('not-a-date')).toBe(false)
  })
})

// ─────────────────────────────────────────
// 統合検証
// ─────────────────────────────────────────
describe('verifyQr (signature + business)', () => {
  it('正規フロー → ok', () => {
    const token = generateQrToken(payload, QR_SECRET)
    const r = verifyQr(token, baseStore, () => baseUser)
    expect(r.ok).toBe(true)
  })

  it('署名NG が優先（ビジネス検証は走らない）', () => {
    const token = generateQrToken(payload, OTHER_SECRET)
    const r = verifyQr(token, baseStore, () => null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('QR_INVALID_SIGNATURE')
  })
})

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────
describe('utilities', () => {
  it('generateQrSecret は 64 文字の hex', () => {
    const s = generateQrSecret()
    expect(s).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(s)).toBe(true)
  })

  it('base64url encode/decode round-trip', () => {
    const input = Buffer.from('Hello YUG Attendance / + = test')
    const encoded = base64urlEncode(input)
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('=')
    expect(base64urlDecode(encoded).equals(input)).toBe(true)
  })

  it('computeSignature は決定的', () => {
    const a = computeSignature(payload, QR_SECRET)
    const b = computeSignature(payload, QR_SECRET)
    expect(a).toBe(b)
  })

  it('computeSignature: key 違いで異なる出力', () => {
    expect(computeSignature(payload, QR_SECRET)).not.toBe(
      computeSignature(payload, OTHER_SECRET),
    )
  })
})
