# 顔認証打刻 (Phase 3)

## 概要

`/clock/face` で顔認証による打刻を行う機能。ブラウザ完結（サーバーに画像を送らない）実装。

## 技術スタック

- **face-api.js** — TinyFaceDetector + FaceRecognitionNet をブラウザで実行
- モデルファイル: `public/models/` (tiny_face_detector / face_recognition)
- 特徴ベクトル: 128次元 float 配列 (3枚撮影、各アングル)

## DB スキーマ

`users` テーブルの追加カラム（migration `0007_face_auth`）:

| カラム | 型 | 説明 |
|---|---|---|
| `face_descriptors` | jsonb | 128次元ベクトル × 3枚 (`number[][]`) |
| `face_auth_enabled` | boolean | 顔認証ON/OFF |
| `face_image_consent` | boolean | 画像保存同意 |
| `face_registered_at` | timestamptz | 登録日時 |
| `face_failed_count` | integer | 連続認証失敗数 |
| `face_last_failed_at` | timestamptz | 最終失敗日時 |

## 顔登録フロー (`/me/face/setup`)

1. カメラ起動 → face-api.js モデル読み込み
2. 正面 / 左45° / 右45° の3枚を順に撮影
3. 各フレームで `extractDescriptor()` → 128次元ベクトル取得
4. 3枚撮影完了後、`registerFaceAction` (Server Action) で DB に保存
5. 元の顔画像はブラウザ内のみで破棄（ベクトルのみ保存）

## 顔認証打刻フロー (`/clock/face`)

1. カメラ起動 → ログインユーザーの `face_descriptors` を `/api/users/[id]/face-descriptors` で取得
2. 映像フレームごとに `matchFace()` — ユークリッド距離 < 0.5 で一致判定
3. 連続3フレーム一致 → `/api/clock/face` に POST
4. 認証成功 → `attendance` 挿入/更新、音声読み上げ
5. 認証失敗 → `face_failed_count` をインクリメント（5回失敗でロック予定）

## API エンドポイント

- `GET /api/users/[id]/face-descriptors` — 自分のベクトル取得（本人のみ）
- `POST /api/clock/face` — 顔認証打刻（認証済み必須）
- `POST /api/users/[id]/face-reset` — 顔データリセット（管理者 or 本人）

## 管理者操作

`/admin/users/[id]` の「認証設定」タブから:
- 顔認証 ON/OFF 切り替え
- 顔データリセット（Storage の顔画像も削除）

## セキュリティ注意

- `face_descriptors` は128次元の数値配列で元画像を復元不可
- RLS: `users` テーブルは `auth.uid() = id` のみ自分のデータ参照可
- 顔認証 API は認証 + 本人確認を二重チェック
