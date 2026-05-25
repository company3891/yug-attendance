# YUG Attendance

飲食業界向け 多店舗対応 出退勤管理SaaS

**運営**: 株式会社YUG
**バージョン**: 0.1.0 (Phase 1 完了)

---

## 📌 プロジェクト概要

顔認証・QRコード・外出ボタンによる打刻、労働時間の自動計算、有給管理、シフト管理、AIシフト自動生成、Slack/LINE通知、給与計算連携CSVを備えた、飲食店向けの統合勤怠管理システムです。

**主な特徴**
- 顔認証打刻（face-api.js でブラウザ完結）— Phase 3
- QRコード打刻 + 外出時ボタン打刻 — Phase 2 / 10
- 労働時間の自動計算（8項目）— Phase 2
- 年間カレンダー（祝日自動取得・変形労働時間制対応）— Phase 6
- AIシフト自動生成（Claude API連携）— Phase 9
- 給与計算連携（freee/マネーフォワード/PCA形式CSV出力）— Phase 4
- Slack/LINE 通知（打刻忘れ・残業アラート等）— Phase 5

---

## 🛠 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js 14 (App Router) + TypeScript (strict) |
| UIライブラリ | Tailwind CSS + shadcn/ui (New York style) |
| 認証 | Supabase Auth (Email/Password) |
| データベース | Supabase (PostgreSQL) + Row Level Security |
| ストレージ | Supabase Storage |
| 顔認証 | face-api.js（ブラウザ完結） |
| QRコード | qrcode.react / html5-qrcode |
| ホスティング | Vercel |
| Cron | Vercel Cron Jobs |
| 通知 | Slack Incoming Webhook + LINE Messaging API |
| AIシフト生成 | Anthropic Claude API (`claude-sonnet-4-6`) |
| 帳票 | exceljs |

---

## 🚀 セットアップ手順

### 1. 依存インストール

```bash
npm install
```

> **Dropbox内に置く場合**: Dropbox の「選択同期」で `node_modules` と `.next` を**必ず除外**してください（数百MB〜数GB同期される）。
> Windowsタスクトレイ → Dropbox → 設定 → 同期 → 「選択型同期」

### 2. Supabase プロジェクトの作成

1. https://supabase.com にアクセスしてアカウント作成
2. 「New Project」でプロジェクト作成（Region: `Northeast Asia (Tokyo)`）
3. Project URL と `anon` / `service_role` キーを「Settings → API」で確認
4. Supabase CLI をインストール
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <PROJECT_REF>
   ```
5. マイグレーション適用（`supabase/migrations/` 配下が順に走る）
   ```bash
   npm run db:push
   ```
6. Seed データ投入（2 ステップ）
   ```bash
   # (a) 静的参照データ（会社・店舗・部門・シフトパターン）
   #     ローカル開発時:
   npm run db:reset
   #     本番Supabase:
   #     Dashboard > SQL Editor に supabase/seed.sql を貼って Run

   # (b) 4 テストユーザーを Auth Admin API 経由で作成
   #     ※ auth.users への直接 INSERT は使えないため必ず Node 経由
   npm run db:seed-users
   ```

### 3. 環境変数

`.env.local.example` を `.env.local` にコピーして値を入れる:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. 開発サーバー起動

```bash
npm run dev
# → http://localhost:3000
```

> **重要**: `npm run dev` を実行したウィンドウを **閉じないでください**。閉じるとサーバーも止まります。

### サーバーが止まった時の対処

**ワンクリック復旧**: エクスプローラーで `scripts/dev-start.cmd` をダブルクリック。
新しい黒いウィンドウが開いてサーバーが起動します（このウィンドウは閉じないこと）。

**コマンドで復旧**:
```bash
npm run dev:restart
```

**手動で復旧**:
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
cd "C:\Users\yusug\Dropbox (個人用) (1)\02 株式会社YUG\yug-attendance"
npm run dev
```

### 5. 型生成（マイグレーション変更時）

```bash
npm run db:types
```

### 6. Vercel へのデプロイ

1. https://vercel.com にアクセスしてアカウント作成
2. GitHub と連携 → Import Project
3. 環境変数を Vercel ダッシュボードで全件登録
4. Build & Deploy
5. Cron Jobs は Phase 5 で `vercel.json` を追加

---

## 🔁 開発フロー

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | **認証 + 権限制御 + 従業員CRUD** | ✅ 完了 |
| Phase 2 | QR打刻 + 労働時間計算 + 自分の勤怠 | 未着手 |
| Phase 3 | 顔認証打刻（face-api.js） | 未着手 |
| Phase 4 | 打刻修正・管理者画面・CSV出力 | 未着手 |
| Phase 5 | 有給管理 + Slack/LINE通知 | 未着手 |
| Phase 6 | 年間カレンダー | 未着手 |
| Phase 7 | シフトパターン + カレンダー | 未着手 |
| Phase 8 | シフト希望・交代・人件費 | 未着手 |
| Phase 9 | AIシフト自動生成 | 未着手 |
| Phase 10 | 外出打刻・GPS・UI調整 | 未着手 |

各Phase完了時:
1. `npm run build` 通過
2. `npm run lint` 通過
3. 動作確認手順をREADMEに追記
4. git commit
5. ユーザーレビュー承認後に次Phaseへ

### ⚠️ `npm run build` のあとに `npm run dev` に戻すとき

`npm run build` は `.next/` に production 用チャンクを書き込みます。その状態で dev サーバーを起動すると **MODULE_NOT_FOUND で 500 エラー** になります。dev 復帰時は `.next/` を削除してから起動してください。

```powershell
# 例: Windows PowerShell
Remove-Item -LiteralPath .next -Recurse -Force
npm run dev
```

### よく使うコマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript 型チェック |
| `npm run format` | Prettier |
| `npm run db:push` | マイグレーション適用 |
| `npm run db:reset` | ローカルDBリセット + seed |
| `npm run db:types` | Supabase型再生成 |

---

## 🔐 環境変数一覧

| 変数名 | 用途 | 必須Phase |
|-------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトURL | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon キー | Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role キー（秘密） | Phase 1 |
| `ANTHROPIC_API_KEY` | Claude API（AIシフト生成） | Phase 9 |
| `SLACK_WEBHOOK_URL` | Slack 通知 | Phase 5 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API | Phase 5 |
| `CRON_SECRET` | Vercel Cron 認証 | Phase 5 |

---

## ✅ Phase 1 動作確認手順

### 前提
- 「セットアップ手順」の 1〜4 を完了
- Seed データ投入済み（マスター/店舗/管理者/従業員の4ユーザー）

### テストアカウント

| 権限 | メール | パスワード |
|------|--------|-----------|
| マスター | `master@yug.co.jp` | `Master#2026` |
| 店舗管理 | `store@yug.co.jp` | `Store#2026` |
| 部門管理 | `admin@yug.co.jp` | `Admin#2026` |
| 従業員 | `staff@yug.co.jp` | `Staff#2026` |

⚠️ 本番環境では必ずパスワードを変更してください。

### テストシナリオ

1. **ログインフロー**
   - `http://localhost:3000/` にアクセス → `/login` にリダイレクトされる
   - `master@yug.co.jp` / `Master#2026` でログイン
   - `/dashboard` に遷移し、「こんにちは、杉本 悠 さん」と表示される

2. **権限制御（middleware）**
   - 一旦ログアウト → `/dashboard` に直接アクセス → `/login?next=/dashboard` にリダイレクト
   - `staff@yug.co.jp` でログイン → `/admin/users` にアクセス → `/dashboard` にリダイレクトされる
   - `admin@yug.co.jp` でログイン → `/admin/users` にアクセスできる
   - `staff@yug.co.jp` で `/master/companies` にアクセス → `/dashboard` にリダイレクト

3. **従業員CRUD**
   - `admin@yug.co.jp` でログイン → `/admin/users` で一覧が表示される（部門所属の従業員のみ）
   - `master@yug.co.jp` でログイン → `/admin/users` で全員が表示される
   - 「新規追加」から従業員を作成 → 一覧に追加される
   - 既存従業員の「編集」 → 役職を変更して保存 → 一覧に反映される
   - 「無効化」 → ステータスが「無効」に変わる

4. **RLS 動作確認**
   - Supabase ダッシュボードの SQL Editor で `staff@yug.co.jp` のロールで以下を実行:
     ```sql
     select id, name from users;
     ```
   - 自分の行 (`スタッフ 次郎`) のみ返ることを確認（同店舗の他従業員は見えない）

5. **API ヘルスチェック**
   - `http://localhost:3000/api/health` → `{"ok": true, "phase": 1, ...}` が返る

### ビルド検証

```bash
npm run lint        # エラーなし
npm run type-check  # エラーなし
npm run build       # 成功
```

---

## 🔒 セキュリティ要件（遵守事項）

- メールアドレスは HTML に平文で書かない（`<MailLink />` 使用）
- 全テーブルで Row Level Security (RLS) 有効化
- 顔特徴ベクトルのみ保存（元画像は保存しない）
- パスワードは Supabase Auth (bcrypt) に委任
- QRコードは店舗ごとの `qr_secret` で HMAC 署名（Phase 2）
- 監査ログ（`audit_logs`）で打刻修正履歴を保全（Phase 4）

---

## 📁 ディレクトリ構成

```
yug-attendance/
├── app/
│   ├── (auth)/login/             # ログイン画面
│   ├── (auth)/logout/            # ログアウトAPI
│   ├── dashboard/                # ダッシュボード
│   ├── me/                       # 従業員自身の画面
│   ├── admin/users/              # 従業員CRUD
│   ├── master/companies/         # 会社管理（マスター）
│   ├── api/                      # API Routes
│   ├── layout.tsx
│   ├── page.tsx                  # /dashboard へリダイレクト
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui (button, input, label, card, select)
│   └── app-nav.tsx
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── auth/roles.ts             # ロール判定
│   ├── utils/mail.tsx            # MailLink (JS分割)
│   ├── utils.ts                  # cn()
│   └── database.types.ts         # Supabase型
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql  # 16テーブル
│   │   └── 0002_rls_policies.sql    # RLS
│   ├── seed.sql                     # Seed
│   └── config.toml
├── middleware.ts                 # 権限ガード
├── tailwind.config.ts            # ティファニーカラー
├── CLAUDE.md                     # プロジェクトルール
└── README.md
```

---

## 📖 参考ドキュメント

- [attendance-system-spec.md](./attendance-system-spec.md) — 詳細仕様
- [initial-setup-items.md](./initial-setup-items.md) — 初期設定項目
- [CLAUDE.md](./CLAUDE.md) — 開発ルール

---

## ⏱ Phase 2: QR 打刻

### 機能概要

| 画面 | URL | 役割 |
|---|---|---|
| 打刻読取 | `/clock/qr` | タブレットでカメラ起動 → QRを読み取って打刻 |
| QR管理 | `/admin/users/qr` | 個人QR一覧・印刷・再発行・失効 |
| 自分の勤怠 | `/me/attendance?year=&month=` | 月別カレンダー（PC月グリッド/モバイル日別カード）|

### QR の発行〜運用フロー

1. **管理者**: `/admin/users/qr` を開く
2. 各従業員のカードで「**発行**」または「**再発行**」ボタンをクリック
   - 内部的に `users.qr_version` を +1 してから新トークン生成
   - 旧 QR は即時失効（version 不一致で拒否）
3. **「印刷」ボタン** でブラウザ印刷（A4 で約 9 枚／ページ）
4. 印刷された QR を従業員に配布

### 打刻フロー

1. **タブレット端末**: `/clock/qr` を開く（管理者または従業員アカウントでログイン）
2. ブラウザがカメラ起動 → 「許可」をクリック
3. 従業員が個人QR をカメラにかざす
4. 自動判定:
   - 当日初回 → 出勤記録
   - 出勤済み・退勤未 → 退勤記録（労働時間を画面表示）
   - 出退勤両方済み → 「本日打刻済み」エラー（Phase 10 で外出打刻対応予定）
5. 連続打刻防止: **直前打刻から 60 秒以内は拒否**
6. 成功/失敗はトーストで 3 秒表示後、自動的にスキャン再開

### タブレット最適化

- 横向き全画面（背景 deepgray, テキスト大）を想定
- iPad Safari 推奨。Android Chrome でも動作
- 全画面表示: ブラウザの共有ボタン → 「ホーム画面に追加」 → PWA 風に表示
- カメラは背面 (`facingMode: 'environment'`) を優先

### QR の失効 / 再発行

- **失効** (`qr_revoked_at` セット): 再発行せずブロックのみ → 該当ユーザー打刻不可
- **再発行**: `qr_version +1`、`qr_revoked_at` クリア → 旧 QR 即時失効、新 QR を印刷配布
- **3年経過**: 「更新推奨」バッジ表示（打刻は通る、運用判断）
- 失効・再発行はすべて `audit_logs` に記録

### 詳細

API 仕様: [docs/clock-api.md](./docs/clock-api.md)

---

## 🗄 Phase 毎バックアップ

各 Phase 完了時は以下で 3 重バックアップを取る:

```powershell
npm run backup -- -Phase 1 -Message "Phase 1 完了"
```

実行内容:
1. `git add -A` + `git commit -m "feat(phase-1): Phase 1 完了"`
2. `git tag phase-1-complete-YYYYMMDD`
3. リモート設定済なら `git push --tags`
4. `pg_dump`（`DATABASE_URL` 環境変数 + pg_dump CLI 必要）で `backups/db/phase-1-YYYYMMDD.sql`
5. `backups/snapshots/phase-1-YYYYMMDD.zip` にコード一式

> Dropbox は自動同期で本リポジトリ自体を保護。`backups/` は `.gitignore` 対象だが Dropbox には残る。

### DB ダンプ（手動の代替手順）

`pg_dump` を入れたくない場合は Supabase Dashboard:
- Database → Backups（Pro プラン以上で自動）
- または SQL Editor で `pg_dump_table()` を流して結果を保存

---

## 📱 モバイル連動

スマホ/タブレットから本プロジェクトを触る推奨構成:

| 用途 | ツール |
|---|---|
| 状況確認・PR レビュー | GitHub Mobile アプリ |
| 軽編集（PR コメント / 1ファイル修正） | github.dev（URL の `github.com` を `github.dev` に変えるだけ）|
| 本格開発 | GitHub Codespaces（月60時間まで無料）|
| 実機動作確認 | Vercel デプロイの URL |
| iOS で Git 操作 | Working Copy アプリ |

### セットアップ手順

1. GitHub でプライベートリポジトリ `yug-attendance` 作成
2. ```bash
   git remote add origin git@github.com:<your-account>/yug-attendance.git
   git push -u origin main
   git push --tags
   ```
3. Vercel ダッシュボードで GitHub 連携 → Import → 環境変数 `.env.local` 同等を登録
4. スマホに GitHub Mobile アプリをインストール
5. PR を作成すれば Vercel が自動で Preview URL を発行（スマホで動作確認可能）

---

## © 2026 株式会社YUG
