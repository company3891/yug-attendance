# 音声読み上げ機能 (Phase 3)

## 概要

打刻成功時に Web Speech API (`SpeechSynthesis`) で「〇〇さん、出勤しました」と読み上げる機能。

## 実装ファイル

- `lib/speech.ts` — 音声合成ユーティリティ（純関数）
- `lib/speech.test.ts` — vitest ユニットテスト

## 主な関数

### `announceClock(lastName, event, enabled?)`

```typescript
announceClock('杉本', 'clock_in', true)
// → 「杉本さん、出勤しました」
```

| event | 読み上げ文 |
|---|---|
| `clock_in` | 「〇〇さん、出勤しました」 |
| `clock_out` | 「〇〇さん、退勤しました」 |
| `break_start` | 「〇〇さん、休憩を開始しました」 |
| `break_end` | 「〇〇さん、休憩を終了しました」 |

### `resolveVoiceEnabled(userSetting, storeDefault)`

音声ON/OFFを決定する優先順位:
1. ユーザー個人設定 (`voice_announcement_enabled`) が `true` or `false` → それを使用
2. ユーザー設定が `null`（未設定）→ 店舗設定 (`voice_announcement_default`) を使用
3. 両方 null/undefined → デフォルト `true`

### `extractLastName(fullName)`

```typescript
extractLastName('杉本 悠')  // → '杉本'
extractLastName('田中　花子') // → '田中'（全角スペース対応）
```

## 設定場所

### 個人設定 (`/me/profile`)
- 自分の音声読み上げを設定（ON/OFF/デフォルト）

### 管理者設定 (`/admin/users/[id]` → 認証設定タブ)
- 対象ユーザーの音声設定を変更可能

### 店舗デフォルト
- `stores.voice_announcement_default` — Phase 4 以降で管理画面から設定予定

## 利用箇所

| 画面 | ファイル |
|---|---|
| ボタン打刻 | `app/dashboard/...` → `buttonClockAction` の戻り値 `voice` を使用 |
| QR打刻 | `app/clock/qr/clock-reader.tsx` → スキャン成功後に `announceClock()` |
| 顔認証打刻 | `app/clock/face/face-clock.tsx` → 認証成功後に `announceClock()` |

## ブラウザ対応

- Chrome / Edge: ✅ 日本語音声利用可能
- Safari (iOS/macOS): ✅ 日本語音声利用可能
- Firefox: △ 音声エンジン依存（システム日本語音声が必要）
- タブレット (iPad): ✅ 店舗打刻端末での主要用途

## 自動再生制限への対応

ブラウザのAutoplay Policyにより、ユーザー操作（ボタン押下、QRスキャン）の直後でのみ音声再生が可能。
`announceClock` はユーザー操作のハンドラ内から呼ぶこと。
