# CLAUDE.md

このファイルはClaude Codeがプロジェクト起動時に自動で読み込みます。
プロジェクト固有のルールと作業方針をここに集約しています。

---

## プロジェクト概要

**YUG Attendance** - 飲食業界向け多店舗対応 出退勤管理SaaS

- 運営: 株式会社YUG（代表: 杉本 悠）
- 仕様書: `attendance-system-spec.md`（必ず参照すること）
- 初期設定: `initial-setup-items.md`

---

## 絶対に守るべきルール

### セキュリティ
1. **メールアドレスはHTMLソースに平文で書かない**
   - JavaScriptで文字列を分割・動的生成し、ブラウザのソース表示で見えないように隠す
   - 例：`'support' + '-co@' + 'yug-yug.net'` のように分割

2. **環境変数は絶対にコミットしない**
   - `.env.local` は `.gitignore` に必ず含める
   - 公開リポジトリにする場合は `.env.example` を用意

3. **顔特徴ベクトルは復元不可能な特徴量のみ保存**
   - 元の顔画像は保存しない
   - face-api.jsの128次元ベクトルのみDBへ

4. **Supabase Row Level Security (RLS) を全テーブルで有効化**
   - 例外なし。すべてのテーブルにポリシー設定必須

### コード品質
1. **TypeScript strict mode 必須**
   - `tsconfig.json` で `"strict": true`
   - `any` 型の使用は原則禁止（やむを得ない場合はコメント必須）

2. **ビルド・lint確認**
   - コミット前に必ず `npm run build` と `npm run lint` が通ること
   - 警告も極力なくす

3. **変更時の確認ルール**
   - テキスト・数値の変更依頼を受けたら、grep等で全文検索し変更漏れを**2度確認**してから完了報告
   - LP・サイト編集前に必ずバックアップファイルを作成（例：`ファイル名_backup_YYYYMMDD.html`）

### Server Action 実装ルール（Phase 2 以降必須）

1. **`lib/forms/parse.ts` の `parseFormData()` を必ず使う**
   - 直接 `schema.parse()` を呼ぶことは禁止（throw して Runtime Error 画面に飛ぶ）
   - 直接 `schema.safeParse()` を呼ぶことも非推奨（各アクションで毎回 fieldErrors 整形するのは無駄）

2. **戻り値は `ActionState<TFields>` 型で統一**
   - `lib/forms/parse.ts` から import
   - 成功時: `actionOk(message?)`
   - 全体エラー: `actionFail(formError)`
   - フィールドエラー: `{ ok: false, fieldErrors: parsed.fieldErrors }`

3. **スキーマは必ず 3 分離（CRUD ごと）**
   - 新規作成 (`xxxCreateSchema`)
   - 編集 (`xxxUpdateSchema`)
   - 単発処理（パスワード変更、削除、承認など）はそれぞれ専用スキーマ
   - 1 スキーマを使い回さない（disabled フィールドのバグ再発防止）

4. **`<Input disabled>` は送信されない**
   - 表示だけ残して送信もしないなら現状の `disabled` 表示でOK
   - 表示は変更不可だが値を送りたいなら `<input type="hidden" name="..." value="..." />` を別途置く
   - `readOnly` は送信されるが視覚的に編集不可

5. **フォームコンポーネントは fieldErrors を受けてフィールド直下に表示**
   - `<ErrorMsg errors={fieldErrors.fieldName} />` パターンで統一
   - formError は別ボックスでフォーム上部 or 下部に表示

6. **テンプレート**（コピペで Server Action を作る雛形）
   ```typescript
   'use server'
   import { parseFormData, actionFail, actionOk, type ActionState } from '@/lib/forms/parse'
   import { mySchema } from '@/lib/schemas/...'

   type MyState = ActionState<'field1' | 'field2' | ...>

   export async function myAction(formData: FormData): Promise<MyState> {
     await requireRole('admin')  // 権限チェック
     const parsed = parseFormData(mySchema, formData)
     if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
     // ... DB 操作
     if (error) return actionFail(error.message)
     return actionOk('完了しました')
   }
   ```

### デザイン
1. **メインカラー**: ティファニーブルー `#0ABAB5`
2. **サブカラー**: ライトティファニー `#81D8D0` / ホワイト / チャコール `#1F2937`
3. **アクセント**: ゴールド `#D4AF37`
4. **エラー**: コーラルレッド `#F87171`
5. **角丸**: `rounded-xl` 基調
6. ダークモード対応必須

---

## 技術スタック

| 領域 | 技術 |
|---|---|
| フレームワーク | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui (New York style) |
| 認証・DB | Supabase Auth + Supabase (PostgreSQL) |
| ストレージ | Supabase Storage |
| 顔認証 | face-api.js（ブラウザ完結） |
| QRコード | `qrcode.react`（生成）、`html5-qrcode`（読取） |
| ホスティング | Vercel |
| 通知 | Slack Incoming Webhook + LINE Messaging API |
| Cron | Vercel Cron Jobs |
| 帳票 | `exceljs`（CSV/Excel出力） |
| AI機能 | Anthropic Claude API（シフト自動生成） |

---

## ディレクトリ規約

```
yug-attendance/
├── app/                  # Next.js App Router
│   ├── (auth)/           # 認証関連グループ
│   ├── clock/            # 打刻画面
│   ├── me/               # 従業員自分用画面
│   ├── admin/            # 管理者画面
│   ├── master/           # マスター画面
│   └── api/              # APIルート（route.ts のみ配置）
├── components/
│   ├── ui/               # shadcn/ui のコンポーネント
│   └── (others)/         # カスタムコンポーネント
├── lib/                  # 共通ロジック・ユーティリティ
│   ├── supabase/         # Supabaseクライアント
│   ├── workTime.ts       # 労働時間計算
│   ├── faceRecognition.ts
│   ├── shift/            # シフト関連
│   ├── calendar/         # 年間カレンダー関連
│   └── notifications/    # Slack/LINE通知
├── public/
│   └── models/           # face-api.js モデルファイル
├── supabase/
│   ├── migrations/       # DBマイグレーション
│   └── seed.sql          # テストデータ
└── middleware.ts         # 権限制御
```

---

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npm run type-check

# Lint
npm run lint

# Supabase ローカル起動
npx supabase start

# マイグレーション作成
npx supabase migration new <name>

# マイグレーション適用
npx supabase db push

# 型定義生成（Supabaseから）
npx supabase gen types typescript --local > lib/database.types.ts

# Vercelデプロイ
vercel --prod
```

---

## 開発フロー

### Phase 単位で進行
1. 1つのPhaseに集中する
2. 完了したら動作確認手順を提示
3. ユーザーのレビュー承認後に次のPhaseへ
4. 各Phase完了時にコミット（メッセージは明確に）

### 現在のPhase進捗（更新していくこと）
- [x] Phase 1: Supabase設定 + 認証 + 権限制御 + 従業員CRUD（実装・ビルド・ログイン疎通完了。実機UI最終確認中）
- [ ] Phase 2: QR打刻 + 労働時間計算 + 自分の勤怠画面
- [ ] Phase 3: 顔認証打刻（face-api.js統合）
- [ ] Phase 4: 打刻修正・管理者画面・レポートCSV
- [ ] Phase 5: 有給管理 + Slack/LINE通知Cron
- [ ] Phase 6: 年間カレンダー（自動生成・編集・所定時間計算）
- [ ] Phase 7: シフトパターン管理 + シフトカレンダー
- [ ] Phase 8: シフト希望提出 + 交代申請 + 人件費シミュレーション
- [ ] Phase 9: シフトAI自動生成（Claude API連携）
- [ ] Phase 10: 外出打刻・GPS・ダッシュボード・UI調整

### コミットメッセージ規約
```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント更新
style: フォーマット変更（機能影響なし）
test: テスト追加・修正
chore: ビルド・補助ツール変更

例:
feat(clock): QRコード打刻機能を実装
fix(workTime): 深夜割増計算の境界値バグを修正
```

---

## 報告・連絡ルール

### 中間報告のタイミング
- 大きなライブラリを導入する前
- 仕様書にない判断が必要になった時
- エラーで30分以上詰まった時
- DBスキーマを変更する時

### 完了報告に必ず含める内容
1. 実装した機能の一覧
2. 動作確認手順（再現可能な形で）
3. 作成・変更したファイル一覧
4. 残課題・既知の制限事項

---

## トラブル対応の優先順位

エラー発生時：
1. まずエラーメッセージを正確に把握
2. 関連するドキュメント（Next.js / Supabase / Tailwind）の公式情報を確認
3. それでも解決しない場合は、ユーザーに以下の形式で報告：
   - エラー全文
   - 発生した操作
   - 試した対処
   - 推測される原因

エラーを隠して別の実装に進むことは絶対にしない。

---

## 参考リンク

- Next.js App Router: https://nextjs.org/docs/app
- Supabase: https://supabase.com/docs
- shadcn/ui: https://ui.shadcn.com
- face-api.js: https://github.com/justadudewhohacks/face-api.js
- Tailwind CSS: https://tailwindcss.com/docs
- 内閣府 祝日CSV: https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv

---

## このファイルの更新ルール

- 仕様変更があったら必ず更新
- 新しいルールが決まったら追記
- Phase完了したらチェックボックスを更新
- 古い情報は削除せず取り消し線で残す（経緯がわかるように）
