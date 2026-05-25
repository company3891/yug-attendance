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

### Server Action 規約（Phase 2 以降必須）

以下は**例外なく遵守**。違反は code review で差し戻し対象。

1. **必ず `lib/forms/parse.ts` の `parseFormData()` を使用**
2. **`parse()` ではなく `safeParse()` 経由**（`parseFormData` が内部で実施）
3. **戻り値は `{ ok: true, data }` | `{ ok: false, fieldErrors }`**（`ActionState<TFields>` 型）
4. **throw せず構造化エラーを返す**
5. **新規追加用と編集用は別スキーマに分離**（`xxxCreateSchema` と `xxxUpdateSchema`、単発処理はさらに専用スキーマ）

#### 補足ルール

- **`<Input disabled>` はフォーム送信されない** — 値を送る必要がない場合のみ disabled、送信しつつ編集不可なら `readOnly`、見せず送るだけなら `<input type="hidden">`
- **フォーム側はフィールド直下にエラー表示** — `<ErrorMsg errors={fieldErrors.xxx} />` パターン
- **formError は別ボックス** でフォーム上部 or 下部に表示
- **成功時のヘルパー**: `actionOk(message?)` / 全体エラー: `actionFail(formError)`

#### 雛形コード（コピペ用）

```typescript
'use server'
import { parseFormData, actionFail, actionOk, type ActionState } from '@/lib/forms/parse'
import { requireRole } from '@/lib/auth/roles'
import { mySchema } from '@/lib/schemas/...'

type MyState = ActionState<'field1' | 'field2' | ...>

export async function myAction(formData: FormData): Promise<MyState> {
  await requireRole('admin')                          // 権限チェック
  const parsed = parseFormData(mySchema, formData)    // safeParse 内蔵
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
  // parsed.data は z.infer<typeof mySchema> 型
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

### 労働時間計算の規約（Phase 2 以降必須）

| 区分 | 割増率 | 計算先カラム |
|---|---|---|
| **法定休日**（週1回・通常 日曜）労働 | **35%** | `work_time_calculations.holiday_minutes` |
| **所定休日**（週休2日制の土曜等）労働 | 25% | `over_scheduled_minutes` に集約 |
| **深夜（22:00-5:00）** | 25% | `midnight_minutes`（休日労働と重複可能）|
| **法定外労働**（日8h超 / 週40h超）| 25% | `over_legal_minutes` |
| **所定外労働**（店舗所定時間超）| 0% (基本給) | `over_scheduled_minutes` |

**重要原則**:
- 法定休日と所定休日を区別する（前者のみ 35%、後者は所定外扱い）
- 深夜割増は **他の割増と重複加算可**（深夜の休日労働 = 35% + 25%）
- 計算ロジックは `lib/workTime.ts` の純関数に集約、Date 入出力のみ
- 日付またぎ判定は `stores.day_start_time` を基準（飲食店の深夜営業対応）

### タイムゾーン処理規約（Phase 2 以降必須）

| 層 | タイムゾーン | 理由 |
|---|---|---|
| **DB (PostgreSQL)** | **UTC** で保存（`timestamptz` 型）| Supabase 既定。グローバル運用時の混乱を避ける |
| **計算ロジック (`lib/workTime.ts`)** | **JST固定** で扱う | 日本国内の労働基準法準拠。「22:00-05:00」はJST解釈 |
| **UI 表示** | **JST固定** | ユーザーは日本国内 |
| **テスト (vitest)** | **TZ=Asia/Tokyo 環境変数で固定** | CI/開発環境で同じ結果を保証 |

**実装ルール**:
- 日時の生成は `new Date('2026-05-23T09:00:00+09:00')` で **必ず JST オフセット明示**
- DB → TS 変換時は Supabase クライアントが自動で `Date` (UTC内部) に変換
- 表示時は `toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })` または `date-fns-tz`
- vitest 実行時は `TZ=Asia/Tokyo npm test` の形式（CI ワークフローも同じ）
- `Date.getHours()` 等のローカルメソッドは **PC のローカルTZに依存** するので注意。テストで TZ=Asia/Tokyo を固定すれば JST 動作

**禁止事項**:
- `new Date('2026-05-23')` のような **オフセットなし日付文字列** は環境依存 → 必ず `T00:00:00+09:00` まで書く
- DB に `timestamp` (タイムゾーンなし) 型を使わない → 必ず `timestamptz`
- フロントエンドで `moment.js` 等の重量ライブラリは使わない（軽量な date-fns 系を推奨）

### 打刻データの異常検知

`attendances` テーブルに `has_anomaly boolean` + `anomaly_codes text[]` を持つ。
複数の異常を同時に持てる構造（配列）。管理画面では `unnest()` で集計可能。

#### 打刻異常コード一覧

| コード | 説明 | 検出層 | 対処 |
|---|---|---|---|
| `clock_out_before_in` | 退勤時刻 < 出勤時刻 | API (422拒否) / 修正時のみDB | 管理者が修正 |
| `break_exceeds_work` | 休憩時間 > 実労働時間 | `lib/workTime.ts` | labor を 0 にクランプ、警告ログ |
| `duration_over_24h` | 連続勤務 24 時間超 | `lib/workTime.ts` | 警告表示、別 attendance に分割推奨 |
| `duplicate_clock` | 連続打刻（前回から1分以内）| `app/api/clock/route.ts` | API で 422 拒否、DB保存しない |

**追加時のルール**:
- 新コードを追加する時は本表 + `lib/workTime.ts` の `AnomalyCode` union + migration の comment を同時更新
- DB の `anomaly_codes` カラムは text[] で自由格納だが、コード値は本表に必ず追記
- 管理画面の表示文言は `lib/i18n/anomaly.ts`（Phase 4 で作成予定）に集約

### 監査ログ（audit_logs）記録規約

以下の操作は **必ず `audit_logs` テーブルに INSERT** する。漏れは Phase 4 のレビューで検出。

| カテゴリ | トリガー | actor / before / after | 実装Phase |
|---|---|---|---|
| **QR失効** | `users.qr_revoked_at` を更新 | 操作管理者UID / qr_version / 新qr_version | **Phase 2** |
| 有効化/無効化 | `users.is_active` 変更 | 操作管理者UID / true↔false | Phase 4 |
| 打刻修正 | `attendances.modified_by` 入力 | 修正者UID / 修正前打刻 / 修正後打刻 | Phase 4 |
| 給与情報変更 | `users.hourly_wage / monthly_wage / daily_wage / wage_type` 変更 | 操作管理者UID / 旧値 / 新値 | Phase 4 |
| 権限変更 | `users.role` 変更 | 操作管理者UID / 旧role / 新role | Phase 4 |
| マスター操作 | `companies` / `stores` の追加・削除 | マスターUID / 操作種別 | Phase 4 |

**実装パターン**:
```typescript
// Server Action 内で操作直後に呼ぶ
await admin.from('audit_logs').insert({
  actor_id: me.id,
  action: 'user.qr_revoke',           // 'resource.operation' 形式
  resource_type: 'users',
  resource_id: targetUserId,
  before_data: { qr_version: 1, qr_revoked_at: null },
  after_data: { qr_version: 2, qr_revoked_at: new Date().toISOString() },
})
```

Phase 2 では **QR失効のみ** 実装。残り5カテゴリは Phase 4 で一括対応。

### レスポンシブ規約

**ブレークポイント**: Tailwind 標準（`sm:640px / md:768px / lg:1024px / xl:1280px`）。
分岐の主軸は **`md` (768px)** — これより下をモバイル、上をデスクトップとして扱う。

1. **データテーブルは必ずモバイル時にカード化**
   - `md未満` で `<table>` を縦長表示にしない（文字が縦書きになる）
   - パターン:
     ```tsx
     <div className="hidden md:block">{/* デスクトップ: <table> */}</div>
     <div className="md:hidden space-y-3">{/* モバイル: <UserCard /> など */}</div>
     ```
   - カードコンポーネントは `components/<domain>/<entity>-card.tsx` に配置
   - 例: `components/users/user-card.tsx`、`components/attendances/attendance-card.tsx` (Phase 4)

2. **モバイルカードの最低構造**
   - 上部: 主要識別子（氏名・日付など）+ 状態バッジ（右寄せ）
   - 中段: `dl` で `grid-cols-[80px_1fr]` のラベル+値2カラム
   - 下部: 操作ボタン（`flex gap-2`、各ボタン `flex-1` で幅を等分、タップ44px以上確保）
   - 枠: `rounded-xl border border-tiffany-100 p-4 shadow-sm`

3. **共通化の判断基準**
   - 1画面だけなら専用コンポーネントで OK
   - **3画面目が現れた時点で `components/ui/responsive-table.tsx` 等に抽出**
   - 過剰抽象化を避ける（最初から汎用化しない）

4. **必須レスポンシブチェックリスト**（新規画面追加時）
   - [ ] iPhone SE (375px) 幅で横スクロールが発生しない
   - [ ] ナビゲーション/サイドバーがモバイルで隠れる（ハンバーガー等）
   - [ ] ボタンのタップエリア 44×44px 以上
   - [ ] 入力フォームは1カラム化（`md:grid-cols-2` で2カラム）
   - [ ] テーブルがあればカード版を実装

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
