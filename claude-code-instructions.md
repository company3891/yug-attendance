# Claude Code への指示の出し方

## 🎯 推奨フロー

仕様書が大きいので、**段階的に指示**するのが成功率が高いです。
以下の順序で進めてください。

---

## STEP 0: 事前準備

```bash
# 1. 作業フォルダを作成
mkdir yug-attendance
cd yug-attendance

# 2. 仕様書を配置
# attendance-system-spec.md と initial-setup-items.md を
# このフォルダにコピー

# 3. Claude Codeを起動
claude
```

---

## STEP 1: 最初の指示（プロジェクト全体把握）

Claude Codeを起動したら、まず以下をコピペしてください。

```
このフォルダにある以下2つの仕様書を読み込んでください。

1. attendance-system-spec.md（システム仕様書）
2. initial-setup-items.md（初期設定項目）

読み込んだら、以下を順に実行してください：

【タスク1】
仕様書全体を理解した上で、実装計画を以下の形式でまとめてください：
- 全体アーキテクチャ図（テキストでOK）
- 開発フェーズごとのタスク一覧
- 想定される技術的な難所と対策
- 各Phaseで作成するファイル一覧

【タスク2】
質問・確認事項があれば全部まとめて提示してください。
（仕様の曖昧な部分、技術選定の代替案、追加で必要な情報など）

【タスク3】
最後にREADME.mdの初版を作成してください。
内容は以下：
- プロジェクト概要
- 技術スタック
- セットアップ手順（Supabaseアカウント作成〜Vercelデプロイまで）
- 開発フローの説明
- 環境変数一覧
- 全Phase完了までの想定スケジュール

実装はまだ開始しないでください。
上記3タスクの結果を提示後、私の確認を待ってください。
```

**ここでClaude Codeが質問してきたら、すべて回答してから次に進む。**

---

## STEP 2: プロジェクト初期化

確認が終わったら次の指示：

```
ありがとう。それでは Phase 1 の実装を開始してください。

【Phase 1 タスク】
1. Next.js 14 (App Router) + TypeScript + Tailwind CSS でプロジェクト初期化
2. shadcn/ui をセットアップ（New York style、ティファニーブルー基調）
3. tailwind.config.ts に仕様書の tiffany カラー設定を反映
4. Supabaseクライアント（client/server/middleware）をセットアップ
5. supabase/migrations/ にデータベース全テーブルのSQLを作成
6. 全テーブルに Row Level Security (RLS) ポリシーを設定
7. 認証画面（/login）と権限制御 middleware を実装
8. マスター・店舗・管理者・従業員の4権限のロール判定機能
9. 従業員CRUD画面（/admin/users）の基本実装

【守ること】
- TypeScript strict mode
- ESLint + Prettier 設定
- メールアドレスはHTMLに平文で書かない（JS分割生成ルール）
- 全コミット前に `npm run build` でビルドが通ることを確認
- 各機能の動作確認手順を README.md に追記

【完了したら】
- 動作確認手順を提示
- Phase 2 に進む前に必ず私にレビューを依頼

Phase 1 完了まで、必要に応じて中間報告をしてください。
進捗が見えなくなったら困るので、大きなステップごとに区切って報告してください。
```

---

## STEP 3: 動作確認 → Phase 2 以降

Phase 1の確認が完了したら、以下のパターンで進めます：

```
Phase 1 の動作確認完了しました。
Phase 2 の実装に進んでください。

【Phase 2 タスク】
1. QRコード打刻機能（/clock/qr）
2. 個人QRコード自動発行（PDF出力）
3. 労働時間計算ロジック（lib/workTime.ts）
   - 仕様書「5-2. 労働時間自動計算」の8項目すべて
4. 打刻API（/api/clock）
5. 従業員自分用の勤怠画面（/me/attendance）
   - 月別カレンダー表示
   - 日別の労働時間内訳

【テストデータ】
ダミーの会社1社・店舗1店舗・従業員3名を作成するseed.sqlを
supabase/seed.sql に作成してください。
```

Phase 3以降も同じパターンで「Phase N の実装に進んでください」と指示すればOK。

---

## 🔑 Claude Code への指示で押さえるべきポイント

### ✅ DO（推奨）

1. **小さく区切る** — 1回の指示は1 Phase まで。一度に全部やらせない
2. **完了条件を明示** — 「動作確認手順を提示」「私のレビューを待つ」を毎回入れる
3. **守ってほしいルールを毎回繰り返す** — TypeScript strict、メール隠蔽、ビルド確認など
4. **質問を促す** — 「不明点があれば全部聞いて」と最初に言う
5. **進捗報告を要求** — 長いタスクは中間報告必須
6. **テストデータ生成も依頼** — 動作確認用のseed.sqlを作らせる

### ❌ DON'T（避ける）

1. ❌ 「全部一気に作って」 → コンテキスト超過＆品質低下
2. ❌ Phase完了確認なしで次に進む → 後で重大なバグ発見
3. ❌ 質問への回答前に実装開始させる → 設計のズレ
4. ❌ 「いい感じに」「適当に」 → 仕様書を作った意味がなくなる
5. ❌ エラーが出たら全部Claude任せ → エラーログを正確にコピペして渡す

---

## 🚨 トラブル時の対処指示テンプレ

### エラーが出た時
```
以下のエラーが発生しています。原因と修正方法を教えてください。

【エラー内容】
（ターミナルのエラーログをそのままコピペ）

【発生した操作】
（何をしたら出たか）

【関連ファイル】
（怪しいファイル名があれば）
```

### 実装方針を変えたい時
```
〇〇の実装方針を変更したいです。

【現状】
（現在の実装内容）

【変更したい理由】
（なぜ変えるか）

【希望する変更内容】
（どう変えたいか）

影響範囲を調査して、変更計画を提示してから実装してください。
```

### Phaseを巻き戻したい時
```
Phase N のコミットまで巻き戻したいです。
git log を確認して、安全に戻す手順を教えてください。
```

---

## 📝 Phase 完了後の確認チェックリスト

各Phase完了時に必ず以下を確認：

- [ ] `npm run build` が通る
- [ ] `npm run lint` でエラーなし
- [ ] 動作確認手順通りに操作して期待通り動く
- [ ] README.md が更新されている
- [ ] git commit されている（コミットメッセージが明確）
- [ ] 次Phaseの依存関係が満たされている

---

## 🎯 Claude Code の効率的な使い方Tips

### 1. CLAUDE.md を活用する
プロジェクトルートに `CLAUDE.md` を置くと、Claude Codeが起動時に必ず読みます。
ここに以下を書いておくと毎回指示しなくて済みます：

```markdown
# CLAUDE.md

## プロジェクト固有のルール
- TypeScript strict mode 必須
- メールアドレスはHTMLに平文で書かない（JS分割生成）
- LP・サイト編集前にバックアップファイル作成（_backup_YYYYMMDD.html）
- カラーはティファニーブルー（#0ABAB5）基調
- 変更後は必ず grep で変更漏れを2度確認

## よく使うコマンド
- 開発サーバー: `npm run dev`
- ビルド: `npm run build`
- マイグレーション: `npx supabase db push`
- 型生成: `npx supabase gen types typescript --local > lib/database.types.ts`

## ディレクトリ規約
- app/api 配下のルートは route.ts のみ
- 共通ロジックは lib/ に切り出す
- UI コンポーネントは components/ui (shadcn/ui) と components/ (カスタム) に分離
```

### 2. /clear コマンド
コンテキストが長くなったら `/clear` で会話履歴をリセット。
ただし作業状況は CLAUDE.md や README.md に書いておく。

### 3. プランモードを使う
Claude Codeには「Plan Mode」があり、実装前に計画だけ立ててくれます。
複雑なタスクは Plan Mode で計画 → 確認 → 実装、の流れが安全。

### 4. .gitignore を最初に整備
```
node_modules/
.next/
.env.local
.env*.local
*.log
.DS_Store
```

---

## 🚀 全体スケジュール目安

| 期間 | 内容 |
|---|---|
| Day 1 | Phase 0-1 完了（環境構築・認証・従業員CRUD） |
| Day 2-4 | Phase 2-3 完了（打刻・労働時間計算・顔認証） |
| Day 5-7 | Phase 4-5 完了（修正機能・有給・通知） |
| Day 8-10 | Phase 6 完了（年間カレンダー） |
| Day 11-14 | Phase 7-8 完了（シフト管理） |
| Day 15-17 | Phase 9-10 完了（AI生成・外出打刻・UI調整） |
| Day 18-21 | 本番デプロイ・実店舗での試験運用 |

平日の夜＋週末作業で約3週間〜1ヶ月が現実的なライン。

---

## 💡 最初の1回だけ実行する初期コマンド

```bash
# Claude Code をインストール（未インストールの場合）
npm install -g @anthropic-ai/claude-code

# Anthropic API キーを設定
export ANTHROPIC_API_KEY="sk-ant-..."

# プロジェクトフォルダ作成
mkdir yug-attendance && cd yug-attendance

# 仕様書を配置
# (attendance-system-spec.md と initial-setup-items.md をここにコピー)

# Claude Code 起動
claude
```

---

## 📞 困ったときは

実装中に詰まったら、私（Claude.ai）に以下のように相談してください：

```
Claude Codeで〇〇を実装中なんだけど、
こういうエラーが出てる：
（エラー内容）

何が原因？どう直せばいい？
```

設計レベルの相談はClaude.ai（私）、実装作業はClaude Code、と使い分けると効率的です。
