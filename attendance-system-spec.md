# 出退勤管理システム 仕様書（Claude Code 実装用）

## 1. プロジェクト概要

飲食業界向け多店舗対応の出退勤管理SaaS。顔認証・QRコード打刻、自動労働時間計算、有給管理、給与計算連携、Slack/LINE通知を備える。

**システム名**: YUG Attendance（仮）
**運営**: 株式会社YUG

---

## 2. 技術スタック

| 領域 | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) + TypeScript |
| UIライブラリ | Tailwind CSS + shadcn/ui |
| 認証 | Supabase Auth（Email/Password） |
| データベース | Supabase (PostgreSQL) |
| ストレージ | Supabase Storage（顔写真・QR画像） |
| 顔認証 | face-api.js（ブラウザ完結・モデルはpublicに配置） |
| QRコード | `qrcode.react`（生成）、`html5-qrcode`（読取） |
| ホスティング | Vercel |
| 通知 | Slack Incoming Webhook + LINE Messaging API |
| Cron | Vercel Cron Jobs |
| 帳票 | `exceljs`（CSV/Excel出力） |

---

## 3. 権限設計（4階層）

| 権限 | 範囲 | 主な操作 |
|---|---|---|
| **マスター** | 全社・全店舗 | 会社追加、店舗追加、全データ閲覧・編集、システム設定 |
| **店舗** | 自店舗内全データ | 店舗内従業員管理、打刻修正、シフト管理、レポート出力 |
| **管理者** | 担当部門 | 配下従業員の打刻修正、勤怠承認 |
| **従業員** | 自分のデータのみ | 打刻、自分の勤怠閲覧、有給申請 |

権限はDBの`users.role`に`master | store | admin | employee`で持つ。Next.js Middlewareでルート保護。

---

## 4. データベース設計（Supabase / PostgreSQL）

### companies（会社）
```sql
id uuid PK
name text
created_at timestamptz
```

### stores（店舗）
```sql
id uuid PK
company_id uuid FK
name text
address text
qr_secret text  -- 店舗ごとの打刻QR署名キー
created_at timestamptz
```

### users（従業員）
```sql
id uuid PK (Supabase Authと連携)
employee_no text  -- 従業員ナンバー
name text
company_id uuid FK
store_id uuid FK
role text  -- master/store/admin/employee
job_title text  -- 業務
face_descriptor jsonb  -- face-api.jsの128次元特徴ベクトル
hourly_wage int  -- 時給（給与計算用）
hire_date date  -- 入社日（有給付与計算用）
paid_leave_days numeric  -- 有給残日数
slack_user_id text  -- 通知用
line_user_id text  -- 通知用
is_active boolean
created_at timestamptz
```

### attendances（打刻記録）
```sql
id uuid PK
user_id uuid FK
store_id uuid FK
work_date date  -- 勤務日
clock_in timestamptz  -- 出勤
clock_out timestamptz  -- 退勤
break_minutes int  -- 休憩（分）
method text  -- face/qr/manual/outside
location_lat numeric  -- 任意：打刻時GPS
location_lng numeric
note text
modified_by uuid FK  -- 修正者（管理者以上）
modified_at timestamptz
created_at timestamptz
```

### breaks（休憩明細・複数休憩対応）
```sql
id uuid PK
attendance_id uuid FK
break_start timestamptz
break_end timestamptz
```

### work_time_calculations（労働時間計算結果・日次集計）
```sql
id uuid PK
attendance_id uuid FK UNIQUE
labor_minutes int           -- 労働時間
scheduled_minutes int       -- 所定時間（例：480分=8時間）
over_scheduled_minutes int  -- 所定外労働時間
over_legal_minutes int      -- 法定外労働時間（週40h・日8h超）
midnight_minutes int        -- 深夜割増時間（22:00-5:00）
midnight_over_minutes int   -- 深夜割増外労働時間
holiday_minutes int         -- 休日労働時間
holiday_over_minutes int    -- 休日労働外時間
calculated_at timestamptz
```

### paid_leaves（有給申請・取得記録）
```sql
id uuid PK
user_id uuid FK
leave_date date
leave_type text  -- full/half_am/half_pm
status text  -- pending/approved/rejected
approved_by uuid FK
applied_at timestamptz
```

### shift_patterns（シフトパターン・テンプレート）
```sql
id uuid PK
store_id uuid FK
name text                  -- 例：「早番」「遅番」「通し」
start_time time            -- 例：09:00
end_time time              -- 例：17:00
break_minutes int          -- 標準休憩時間
color text                 -- カレンダー表示色（HEX）
created_at timestamptz
```

### shifts（シフト・個人別勤務予定）
```sql
id uuid PK
user_id uuid FK
store_id uuid FK
shift_date date            -- 勤務予定日
shift_pattern_id uuid FK   -- パターン適用時（NULL可：個別入力）
start_time time            -- 開始時刻
end_time time              -- 終了時刻
break_minutes int
status text                -- draft/published/confirmed/swap_requested
note text
created_by uuid FK
created_at timestamptz
updated_at timestamptz
UNIQUE (user_id, shift_date)
```

### shift_requests（シフト希望提出）
```sql
id uuid PK
user_id uuid FK
target_month text          -- 'YYYY-MM'
request_date date          -- 希望日
preference text            -- want_work/want_off/flexible
preferred_start time
preferred_end time
note text
submitted_at timestamptz
```

### shift_swaps（シフト交代申請）
```sql
id uuid PK
from_user_id uuid FK
to_user_id uuid FK
from_shift_id uuid FK
to_shift_id uuid FK         -- 交換の場合（片方向は NULL）
swap_type text              -- swap/handover（交換 or 代行）
status text                 -- pending/approved/rejected/cancelled
approved_by uuid FK
requested_at timestamptz
responded_at timestamptz
```

### annual_calendars（年間カレンダー）
```sql
id uuid PK
store_id uuid FK
year int                   -- 例：2026
name text                  -- 例：「2026年度 営業カレンダー」
scheduled_work_days int    -- 年間所定労働日数（自動計算）
scheduled_work_hours numeric -- 年間所定労働時間（自動計算）
weekly_work_hours numeric  -- 週所定労働時間（例：40）
daily_work_hours numeric   -- 1日の所定労働時間（例：8）
status text                -- draft/published
published_at timestamptz
created_at timestamptz
UNIQUE (store_id, year)
```

### calendar_days（年間カレンダー日別設定）
```sql
id uuid PK
calendar_id uuid FK
calendar_date date
day_type text              -- workday/legal_holiday/scheduled_holiday/national_holiday/company_holiday
                           -- workday=出勤日 / legal_holiday=法定休日 / scheduled_holiday=所定休日
                           -- national_holiday=祝日 / company_holiday=会社独自休日（夏季・年末年始等）
label text                 -- 例：「夏季休業」「創立記念日」
note text
UNIQUE (calendar_id, calendar_date)
```

### notifications_log（通知ログ）
```sql
id uuid PK
user_id uuid FK
type text  -- forgot_clock_in/forgot_clock_out/overtime_alert
channel text  -- slack/line
sent_at timestamptz
```

**Row Level Security (RLS)** を全テーブルに必ず設定すること。

---

## 5. 機能要件

### 5-1. 打刻機能

**3つの打刻方式**:
1. **顔認証打刻**（メイン）: 店舗のタブレット等で稼働。webカメラ→face-api.jsで128次元ベクトル抽出→DB内の全従業員ベクトルとコサイン類似度比較→閾値0.6以上で本人特定→打刻
2. **QRコード打刻**: 各従業員に固有QR発行。店舗端末で読み取り→打刻
3. **外出時ボタン打刻**: 従業員のスマホブラウザから「外出開始/外出終了/直帰」ボタンで打刻（GPS座標も記録）

**自動判定ロジック**:
- 同日内で初回打刻 = 出勤
- 出勤後の打刻 = 退勤
- 連続打刻防止（前回打刻から1分以内は無視）

### 5-2. 労働時間自動計算

打刻完了時に以下を自動計算してDBに保存：

| 項目 | 計算式 |
|---|---|
| 労働時間 | 退勤 − 出勤 − 休憩 |
| 所定時間 | 店舗設定（例：8時間） |
| 所定外労働時間 | max(0, 労働時間 − 所定時間) |
| 法定外労働時間 | max(0, 労働時間 − 8時間) |
| 深夜割増時間 | 22:00-5:00に該当する労働時間 |
| 深夜割増外労働時間 | 労働時間 − 深夜割増時間 |
| 休日労働時間 | 休日（要設定）に勤務した時間 |
| 休日労働外時間 | 平日労働時間 |

実装は`/lib/workTime.ts`にユーティリティ関数として切り出すこと。

### 5-3. 打刻修正機能（管理者以上）

- 打刻一覧画面から該当レコードを編集
- 修正履歴は`audit_logs`テーブルに記録（誰が・いつ・何を変更したか）
- 修正後は労働時間を自動再計算

### 5-4. 有給管理

- 入社日から**労基法の有給付与日数**を自動計算（6ヶ月後10日、1年半後11日…）
- 出勤率8割の条件もチェック
- 有給申請→管理者承認フロー
- 残日数ダッシュボード表示

### 5-5. 給与計算連携・CSV出力

月次で以下のCSVを生成（freee人事労務、マネーフォワード給与、PCAクラウド給与の3形式に対応）：
- 従業員ナンバー、氏名、所定内労働時間、所定外労働時間、深夜労働時間、休日労働時間、有給取得日数

### 5-6. シフト管理機能

**シフトパターン管理（店舗権限以上）**
- 「早番（9-17）」「遅番（17-23）」「通し（11-22）」等のテンプレートを登録
- 色分けでカレンダー表示

**シフト希望提出（従業員）**
- 翌月のシフト希望を月15日までに提出
- 各日「出勤希望／休み希望／どちらでも」を選択
- 出勤希望時は希望時間帯も指定可能

**シフト作成（店舗権限以上）**
- ガントチャート風UI（縦軸=従業員、横軸=日付）でドラッグ&ドロップ編集
- パターンをドロップするだけでシフト確定
- **AI自動シフト作成**: 希望・労働基準法・必要人員を考慮してClaude API経由で自動生成（Claudeception機能）
- 公開前は`draft`ステータス、確定時に`published`にして全員に通知

**シフト交代・代行申請（従業員）**
- 自分のシフトを他従業員に「交換」or「代行依頼」
- 相手が承認 → 店舗管理者が最終承認 → 通知
- 承認フローはSlack/LINE通知連動

**シフトvs実績の予実比較**
- 予定時刻と実際の打刻時刻の差分を可視化
- 遅刻・早退・残業を自動検出してアラート

**人件費シミュレーション**
- シフト確定前に各従業員の時給×時間で月間人件費を試算
- 法定外労働時間（25%増）・深夜（25%増）・休日（35%増）も自動計算

### 5-7. 年間カレンダー機能

**簡単作成ウィザード（店舗権限以上）**
- 年を選んで「カレンダー作成」ボタンを押すだけで以下を自動生成：
  - **国民の祝日**: 内閣府の祝日CSVから自動取得（毎年1回更新）→ `national_holiday`
  - **法定休日**: 週1回（デフォルト日曜）を自動で `legal_holiday`
  - **所定休日**: 週休2日制の場合、土曜を `scheduled_holiday`
- その上から「会社独自休日」（夏季休業8/13-16、年末年始12/29-1/3、創立記念日など）を一括追加できる
- 「平日パターン適用」「土日パターン適用」をワンクリックで全月に反映

**カレンダー編集UI**
- 月別カレンダーグリッド表示（12ヶ月をタブ切替 or 1画面サマリー）
- 日付クリック→種別ドロップダウン（出勤日／法定休日／所定休日／祝日／会社独自休日）
- 色分け：出勤日=ティファニー / 法定休日=コーラル / 所定休日=ライトグレー / 祝日=ゴールド
- ドラッグで連続日付を一括設定

**年間所定の自動計算（リアルタイム表示）**
画面上部に常時表示するサマリーカード：
```
┌─────────────────────────────────────┐
│ 2026年度 営業カレンダー              │
│                                      │
│ 年間所定労働日数: 245日              │
│ 年間所定労働時間: 1,960時間          │
│ 年間休日数: 120日                    │
│   うち法定休日: 52日                 │
│   うち所定休日: 52日                 │
│   うち祝日:    16日                  │
│   うち会社休日: 0日                  │
│                                      │
│ 週平均労働時間: 37.7時間 ✅ 法定内    │
└─────────────────────────────────────┘
```
- 週平均労働時間が法定40時間を超える場合は警告表示
- 月別の労働日数・時間も内訳表示

**変形労働時間制への対応**
- 1ヶ月単位／1年単位の変形労働時間制を選択可能
- 1年単位の場合、月別の所定労働時間を個別設定（繁忙期月220h、閑散期月160h等）
- 法定上限（年間2,085時間など）の自動チェック

**シフト・打刻との連携**
- シフト作成画面で年間カレンダーの休日に色付け表示（休日にシフトを入れたら警告）
- 打刻時：法定休日出勤は自動的に「休日労働時間」に集計（35%割増対象）
- 祝日・会社独自休日も労働時間計算に反映

**年間カレンダーPDF/Excel出力**
- 印刷用の月別カレンダー一覧（A3 1枚 or A4×12枚）
- 従業員配布用に画像（PNG）でも出力可能

### 5-8. 通知機能（Slack / LINE）

**Vercel Cronで定時実行**:
- 出勤予定時刻+15分時点で未打刻→「打刻忘れていませんか？」（本人）
- 22:00時点で退勤未打刻→「退勤打刻忘れ」（本人＋店舗管理者）
- 月間残業時間が45時間を超えそうな場合→「残業アラート」（本人＋管理者）
- 翌日のシフト前日20時→「明日は◯時から勤務予定です」（本人）
- シフト希望提出締切3日前→「シフト希望未提出」（本人）
- シフト公開時→「来月のシフトが確定しました」（全員）
- シフト交代申請時→「交代依頼が届きました」（相手＋管理者）

---

## 6. 画面構成

| 画面 | URL | 権限 |
|---|---|---|
| ログイン | `/login` | 全員 |
| 打刻画面（顔認証） | `/clock` | 全員 |
| 打刻画面（QR） | `/clock/qr` | 全員 |
| 外出打刻 | `/clock/outside` | 従業員 |
| 自分の勤怠 | `/me/attendance` | 従業員 |
| 自分のシフト | `/me/shift` | 従業員 |
| シフト希望提出 | `/me/shift/request` | 従業員 |
| シフト交代申請 | `/me/shift/swap` | 従業員 |
| 有給申請 | `/me/leave` | 従業員 |
| 従業員管理 | `/admin/users` | 店舗以上 |
| 打刻一覧・修正 | `/admin/attendances` | 管理者以上 |
| シフト作成（カレンダー） | `/admin/shifts` | 店舗以上 |
| シフトパターン管理 | `/admin/shifts/patterns` | 店舗以上 |
| シフトAI自動生成 | `/admin/shifts/ai-generate` | 店舗以上 |
| 人件費シミュレーション | `/admin/shifts/cost` | 店舗以上 |
| 年間カレンダー一覧 | `/admin/calendar` | 店舗以上 |
| 年間カレンダー編集 | `/admin/calendar/[year]` | 店舗以上 |
| 年間所定サマリー | `/admin/calendar/[year]/summary` | 店舗以上 |
| レポート・CSV出力 | `/admin/reports` | 店舗以上 |
| 店舗管理 | `/master/stores` | マスター |
| 会社管理 | `/master/companies` | マスター |
| ダッシュボード | `/dashboard` | 店舗以上 |

---

## 7. ディレクトリ構成

```
yug-attendance/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── clock/page.tsx              # 顔認証打刻
│   ├── clock/qr/page.tsx           # QR打刻
│   ├── clock/outside/page.tsx      # 外出打刻
│   ├── me/
│   │   ├── attendance/page.tsx
│   │   ├── shift/page.tsx
│   │   ├── shift/request/page.tsx
│   │   ├── shift/swap/page.tsx
│   │   └── leave/page.tsx
│   ├── admin/
│   │   ├── users/page.tsx
│   │   ├── attendances/page.tsx
│   │   ├── shifts/page.tsx          # シフトカレンダー
│   │   ├── shifts/patterns/page.tsx
│   │   ├── shifts/ai-generate/page.tsx
│   │   ├── shifts/cost/page.tsx
│   │   ├── calendar/page.tsx              # 年間カレンダー一覧
│   │   ├── calendar/[year]/page.tsx       # 年間カレンダー編集
│   │   ├── calendar/[year]/summary/page.tsx
│   │   └── reports/page.tsx
│   ├── master/
│   │   ├── stores/page.tsx
│   │   └── companies/page.tsx
│   ├── api/
│   │   ├── clock/route.ts          # 打刻API
│   │   ├── face-recognize/route.ts # 顔認識API
│   │   ├── shifts/route.ts         # シフトCRUD
│   │   ├── shifts/ai-generate/route.ts # AI自動生成
│   │   ├── shifts/swap/route.ts    # 交代申請
│   │   ├── calendar/route.ts       # 年間カレンダーCRUD
│   │   ├── calendar/generate/route.ts  # 自動生成（祝日・休日）
│   │   ├── calendar/export/route.ts    # PDF/Excel出力
│   │   ├── reports/csv/route.ts    # CSV出力
│   │   ├── notifications/cron/route.ts # 通知Cron
│   │   └── ...
│   └── layout.tsx
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── workTime.ts                 # 労働時間計算
│   ├── faceRecognition.ts          # face-api.jsラッパー
│   ├── paidLeave.ts                # 有給計算ロジック
│   ├── shift/
│   │   ├── generator.ts            # AI自動生成（Claude API呼び出し）
│   │   ├── validator.ts            # 労基法チェック
│   │   └── costCalculator.ts       # 人件費計算
│   ├── calendar/
│   │   ├── japaneseHolidays.ts     # 内閣府祝日CSV取得・パース
│   │   ├── scheduledHours.ts       # 年間所定時間計算
│   │   └── variableWorkTime.ts     # 変形労働時間制チェック
│   ├── csvExport.ts                # CSV生成
│   └── notifications/{slack,line}.ts
├── public/
│   └── models/                     # face-api.jsモデル（ssd_mobilenetv1, face_landmark_68, face_recognition）
├── components/ui/                  # shadcn/ui
├── middleware.ts                   # 権限制御
├── .env.local
└── package.json
```

---

## 8. UIデザイン要件

- **メインカラー**: ティファニーブルー `#0ABAB5`
- **サブカラー**: ライトティファニー `#81D8D0` / ホワイト `#FFFFFF` / チャコール `#1F2937`
- **アクセントカラー**: ゴールド `#D4AF37`（重要ボタン・成功通知）
- **エラー/警告**: コーラルレッド `#F87171`
- **背景**: オフホワイト `#FAFAFA`（明モード）/ ディープグレー `#0F172A`（暗モード）
- **フォント**: Inter（英数字）+ Noto Sans JP（日本語）
- **ボタン・カード**: 角丸 `rounded-xl`、ソフトシャドウ、ホバー時に微かなスケールアニメーション
- レスポンシブ対応（PC/タブレット/スマホ）
- 打刻画面は**タブレット横向き想定**で大きなボタン・大きな顔表示エリア
- ダークモード対応

### Tailwind カスタムカラー設定（tailwind.config.ts）
```ts
colors: {
  tiffany: {
    50:  '#E6F7F6',
    100: '#C2EDEB',
    200: '#9EE3E0',
    300: '#7AD9D5',
    400: '#56CFCA',
    500: '#0ABAB5',  // メイン
    600: '#089792',
    700: '#06746F',
    800: '#04514D',
    900: '#022E2B',
  },
  gold: '#D4AF37',
}
```

---

## 9. セキュリティ要件

- **メールアドレスはHTMLに平文で書かない**（JS分割生成）
- 全テーブルでRow Level Security (RLS) 有効化
- 顔特徴ベクトルは復元不可能な特徴量のみ保存（元画像は保存しない）
- パスワードはSupabase Authに任せる（bcrypt）
- QRコードは店舗ごとの`qr_secret`でHMAC署名（複製対策）
- 監査ログ（`audit_logs`）で打刻修正履歴を保全

---

## 10. 環境変数（.env.local）

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=                  # シフトAI自動生成用
SLACK_WEBHOOK_URL=
LINE_CHANNEL_ACCESS_TOKEN=
CRON_SECRET=
```

---

## 11. 開発フェーズ

| フェーズ | 内容 | 目安 |
|---|---|---|
| Phase 1 | Supabase設定 + 認証 + 権限制御 + 従業員CRUD | 3-4日 |
| Phase 2 | QR打刻 + 労働時間計算 + 自分の勤怠画面 | 3日 |
| Phase 3 | 顔認証打刻（face-api.js統合） | 4日 |
| Phase 4 | 打刻修正・管理者画面・レポートCSV | 3日 |
| Phase 5 | 有給管理 + Slack/LINE通知Cron | 3日 |
| Phase 6 | 年間カレンダー（自動生成・編集・所定時間計算） | 3日 |
| Phase 7 | シフトパターン管理 + シフトカレンダー（ドラッグ&ドロップ） | 4日 |
| Phase 8 | シフト希望提出 + 交代申請 + 人件費シミュレーション | 3日 |
| Phase 9 | シフトAI自動生成（Claude API連携） | 3日 |
| Phase 10 | 外出打刻・GPS・ダッシュボード・UI調整 | 3日 |

---

## 12. Claude Codeへの最初の指示文（コピペ用）

```
このファイル（attendance-system-spec.md）を読んで、出退勤管理システムを開発してください。

【最初にやること】
1. Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/uiでプロジェクト初期化
2. Supabaseプロジェクトのセットアップ手順をREADME.mdに記載
3. 仕様書「4. データベース設計」のSQLマイグレーションファイルを `supabase/migrations/` に作成
4. 全テーブルにRow Level Securityポリシーを設定
5. Phase 1（認証＋権限制御＋従業員CRUD）から実装開始

【守ること】
- 仕様書の「9. セキュリティ要件」を絶対遵守
- メールアドレスはHTMLに平文で書かない（JS分割生成）
- 全コミット前にtype-check + lintを通す
- 各機能完了ごとに動作確認手順をREADMEに追記

実装計画を提示してから、Phase 1の作業に入ってください。
```
