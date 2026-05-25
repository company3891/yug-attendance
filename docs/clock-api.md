# Clock API 仕様書 — Phase 2

`POST /api/clock` — QR 打刻 API の正式仕様。

## エンドポイント

```
POST /api/clock
Content-Type: application/json  (または multipart/form-data)
Cookie: Supabase Auth セッション必須
```

## リクエストボディ

```ts
{
  token: string        // QRトークン "yug:v1:<store>:<user>:<ver>:<iat>:<sig>"
  method: 'qr'         // Phase 2 では 'qr' 固定（face/outside は将来）
  store_id: string     // UUID. 打刻端末が紐づく店舗
  location_lat?: number // 任意 GPS（Phase 10 外出打刻で必須化予定）
  location_lng?: number
}
```

## 成功レスポンス (200)

```ts
{
  ok: true,
  event: 'clock_in' | 'clock_out',
  attendance_id: string,           // UUID
  user: { id: string, name: string },
  work_date: '2026-05-23',         // day_start_time 考慮後の勤務日
  clocked_at: '2026-05-23T08:00Z', // ISO8601 UTC
  labor_minutes: number | null     // 退勤時のみ計算済み、出勤時 null
}
```

## エラーレスポンス

全エラーは下記構造を返す:

```ts
{
  ok: false,
  code: string,        // エラーコード（プログラム判定用）
  message: string,     // 日本語メッセージ（ユーザー表示用）
  fieldErrors?: Record<string, string[]>  // VALIDATION_FAILED 時のみ
}
```

### エラーコード一覧

| code | HTTP | 意味 | 対処 |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | リクエスト形式不正 | 入力修正 |
| `QR_INVALID_FORMAT` | 400 | QR形式不正 | QR再読み取り |
| `QR_INVALID_SIGNATURE` | 400 | HMAC不一致（改ざん or 別店舗）| QR再発行 |
| `STORE_MISMATCH` | 400 | 端末店舗と payload の店舗不一致 | 正しい店舗端末で再試行 |
| `UNAUTHORIZED` | 401 | 未ログイン | ログイン |
| `QR_REVOKED` | 401 | 失効済QR | 管理者にQR再発行依頼 |
| `QR_VERSION_MISMATCH` | 401 | 旧バージョンQR | 最新QRを再印刷 |
| `FORBIDDEN` | 403 | 他人のQR | 自分のQR使用 |
| `USER_INACTIVE` | 403 | 無効化アカウント | 管理者問合せ |
| `USER_NOT_FOUND` | 404 | ユーザー不在 | 管理者問合せ |
| `CLOCK_ALREADY_CLOSED` | 422 | 同日 出退勤両方記録済 | 修正依頼（Phase 10 で外出打刻対応）|
| `CLOCK_OUT_BEFORE_IN` | 422 | 退勤 < 出勤 | データ確認 |
| `CLOCK_TOO_FREQUENT` | 429 | 連続打刻（60秒以内）| 60秒以上待つ |
| `INTERNAL_ERROR` | 500 | DB他 | リトライ |

## ロジック詳細

### 連続打刻防止

- **ウインドウ**: 60秒 (`DUPLICATE_CLOCK_WINDOW_SECONDS` 定数)
- **基準時刻**: そのユーザーの **直前の打刻イベント (clock_in or clock_out のうち新しい方)**
- **判定**: `(now - lastEventAt) / 1000 < 60` で `CLOCK_TOO_FREQUENT` 返却
- **使用 index**: `attendances_user_clockin_desc_idx` (migration 0006)

### 同日複数打刻判定

| 当日 attendance | 判定 |
|---|---|
| なし | 出勤 (INSERT) |
| `clock_in` あり / `clock_out` null | 退勤 (UPDATE) |
| `clock_in` / `clock_out` 両方あり | 422 `CLOCK_ALREADY_CLOSED` |
| (異常) clock_in null だが row 存在 | 出勤として扱う |

### 勤務日判定 (`day_start_time`)

`resolveWorkDate(打刻時刻, stores.day_start_time)`:
- `day_start='00:00'`: 真夜中区切り
- `day_start='05:00'` (飲食店): 翌02:00打刻 → **前日の勤務扱い**

### 異常検知

退勤時に `calcWorkTimeBreakdown` で集計し、以下を `attendances.anomaly_codes text[]` に格納:

| コード | 条件 |
|---|---|
| `break_exceeds_work` | 休憩 > 実時間（labor 0 クランプ） |
| `duration_over_24h` | 連続 24h 超 |
| `clock_out_before_in` | 退勤 < 出勤 (API は 422 で拒否、修正時のみ DB 記録) |
| `duplicate_clock` | 連続打刻 (API は 429 で拒否、DB 記録なし) |

## セキュリティ

| 項目 | 実装 |
|---|---|
| HMAC-SHA256 署名 | `lib/qr/generator.ts:computeSignature` |
| 定数時間比較 | `lib/qr/verifier.ts:verifyQrSignature` (`crypto.timingSafeEqual`) |
| QR失効チェック | `qr_revoked_at` IS NOT NULL → QR_REVOKED |
| QR バージョン | `qr_version` 不一致 → QR_VERSION_MISMATCH |
| アカウント無効化 | `is_active = false` → USER_INACTIVE |
| 店舗一致 (3層) | user.store_id == payload.store_id == store.id |
| 本人確認 | ログインユーザー == payload.user_id（他人QR禁止）|
| `qr_secret` 保護 | service_role でのみ取得、レスポンス未含有 |

## パフォーマンス目標

| 指標 | 目標 | 実測 |
|---|---|---|
| `/api/clock` 応答時間 (warm) | 100ms | 108.5ms (dev mode) |
| 連続打刻防止クエリ | O(log n) | partial index 効果 |

## サンプル

### 出勤（成功）

```bash
curl -X POST http://localhost:3000/api/clock \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-eljfghmslfzvaywkzsst-auth-token=..." \
  -d '{
    "token": "yug:v1:22222222-2222-2222-2222-222222222222:2b1c4510-c814-4f74-aadf-d1d56b8e1d92:1:1748000000:abcd...",
    "method": "qr",
    "store_id": "22222222-2222-2222-2222-222222222222"
  }'
```

→
```json
{
  "ok": true,
  "event": "clock_in",
  "attendance_id": "...",
  "user": { "id": "2b1c4510-...", "name": "スタッフ 次郎" },
  "work_date": "2026-05-23",
  "clocked_at": "2026-05-23T00:00:00.000Z",
  "labor_minutes": null
}
```

### 連続打刻拒否

```json
{
  "ok": false,
  "code": "CLOCK_TOO_FREQUENT",
  "message": "前回の打刻から間もないため受け付けられません。1分以上空けて再度お試しください。"
}
```

## 関連

- 純関数: `lib/workTime.ts`, `lib/clockRounding.ts`, `lib/clockLogic.ts`
- QR: `lib/qr/generator.ts`, `lib/qr/verifier.ts`
- スキーマ: `lib/schemas/clock.ts`
- エラー辞書: `lib/errors/translate.ts`
- DB: `supabase/migrations/0006_phase2_schema.sql`
