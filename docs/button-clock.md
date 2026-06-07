# ボタン打刻 (Phase 3)

## 概要

`/dashboard` に設置されたボタンで打刻する機能。QRコードなしで出退勤・休憩の打刻を行える。

## ユーザーフロー

1. `/dashboard` を開く
2. 現在の状態（出勤前 / 勤務中 / 退勤済み）に応じたボタンが表示される
3. ボタンを押す → `buttonClockAction` (Server Action) が呼ばれる
4. 打刻成功 → トースト表示 + 音声読み上げ（設定がONの場合）

## 実装

- Server Action: `lib/actions/face.ts` → `buttonClockAction`
- ダッシュボード: `app/dashboard/page.tsx` (Server Component)
- 打刻ボタン: `components/dashboard/button-clock-client.tsx` (Client Component)

## ボタン種別

| ボタン | event_type | 条件 |
|---|---|---|
| 出勤 | `clock_in` | 当日出勤レコードなし |
| 退勤 | `clock_out` | 出勤済み・退勤前 |
| 休憩開始 | `break_start` | 出勤中（Phase 5 実装予定） |
| 休憩終了 | `break_end` | 休憩中（Phase 5 実装予定） |

## エラーハンドリング

- `CLOCK_TOO_FREQUENT`: 前回打刻から60秒未満 → エラートースト
- `CLOCK_ALREADY_CLOSED`: 本日の出退勤完了済み → エラートースト
- 退勤時刻 < 出勤時刻: `clock_out_before_in` → エラー

## 打刻方法の記録

ボタン打刻は `attendances.method = 'manual'` で記録される（QR打刻は `'qr'`、顔認証は `'face'`）。
