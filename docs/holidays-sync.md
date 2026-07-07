# 祝日マスタ 年次自動更新（japan_holidays sync）

内閣府公式CSVを取得して `japan_holidays` を毎年自動で最新化する機能。
手動 seed の足し忘れ・春分/秋分の暫定値問題を根本解消する。

- 取得元: `https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv`（Shift_JIS）
- 実行: Vercel Cron で毎年 **2月1日**（内閣府が翌年の春分・秋分を2月官報で確定するため）
- 冪等・非破壊: `on conflict (holiday_date) do update`。CSVに無い過去データは削除しない。

## 構成ファイル

| ファイル | 役割 |
|---|---|
| `lib/holidays/parse.ts` | 純ロジック。`decodeShiftJis` / `parseHolidayCsv`（CSV→upsert対象行）/ `summarizeHolidays`。**ネット非依存・単体テスト対象** |
| `lib/holidays/fetch.ts` | ネットワーク取得。`fetchHolidayCsv()`（fetch→Shift_JISデコード）。**本番のみ実通信** |
| `app/api/cron/sync-holidays/route.ts` | GET エンドポイント。CRON_SECRET認証→取得→パース→upsert→audit記録 |
| `vercel.json` | `crons` に毎年2/1（`0 3 1 2 *`）で上記を叩く設定 |
| `lib/holidays/parse.test.ts` | Shift_JIS変換済みCSVサンプルでのパース検証 |

## 動作

1. Vercel Cron が `GET /api/cron/sync-holidays` を `Authorization: Bearer $CRON_SECRET` 付きで呼ぶ。
2. `CRON_SECRET` 未設定→500 / ヘッダ不一致→401（外部・無認証実行を拒否）。
3. CSV取得→Shift_JIS→UTF-8→パース。**パース0件なら中止（DBは一切変更しない）**。
4. `japan_holidays` へ upsert（冪等）。
5. 件数・対象年範囲・実行日時をサーバログ + `audit_logs`（`action='system.holidays_sync'`, `actor_id=null`, `after_data`）に記録。
6. `{ ok: true, count, minYear, maxYear, startedAt, finishedAt }` を返す。

---

## ⚠️ 開発環境の制約（ネットワーク）

**開発環境（WSL/CI）からは cao.go.jp へ接続できない。** そのため CSV取得（`fetch.ts`）の
実通信を伴う動作確認は **本番（Vercel）デプロイ後にしか行えない**。

これを踏まえ、取得（net）とパース（pure）を分離してあり、パース部分だけをネット非依存で
テストしている（`parse.test.ts`）。ロジックの正しさはローカルで担保し、実取得は本番で確認する。

---

## 🔗 依存: Phase 5 マイグレーションの本番適用が前提

`japan_holidays` テーブルは **Phase 5（`supabase/migrations/0008_phase5_master_data.sql`）で定義**
されており、調査時点で **本番DBには未適用**（0008/0009/0010 が未 push）。

**この自動更新機能が本番で動作するには、先に Phase 5 の `db push`（少なくとも 0008）が必要。**
未適用のまま Cron が走ると upsert 先テーブルが存在せず失敗する（`relation "japan_holidays" does not exist`）。

- Phase 5 適用前の注意（リモート移行履歴の照合など）は別途の調査結果に従うこと。
- 本機能のコード自体は Phase 5 とは独立して追加・デプロイ可能だが、**実行成功にはテーブルの存在が前提**。

---

## 🚀 デプロイ後に必要な作業

### 1. 環境変数 `CRON_SECRET` を Vercel に登録

Vercel プロジェクト → Settings → Environment Variables で **`CRON_SECRET`** を追加する
（推奨: 32文字以上のランダム文字列。例: `openssl rand -hex 32`）。

- **Production** 環境に設定すること（Cron は本番デプロイに対して実行される）。
- 登録後に再デプロイして反映。
- Vercel Cron はこの `CRON_SECRET` を検知し、Cron 実行時のリクエストに
  `Authorization: Bearer $CRON_SECRET` を**自動付与**する（アプリ側は一致検証するだけ）。

### 2. Phase 5 マイグレーションの適用

上記「依存」のとおり、`japan_holidays` を含む Phase 5（0008〜）を本番DBへ `db push`（別途指示・別作業）。

### 3. 初回の手動動作確認（2月を待たずに）

デプロイ後、Cron の2月を待たずに手動でエンドポイントを叩いて確認できる。
`CRON_SECRET` の値を使って（**秘匿。ログ・共有厳禁**）:

```bash
curl -i -H "Authorization: Bearer <CRON_SECRETの値>" \
  https://<本番ドメイン>/api/cron/sync-holidays
```

- 期待レスポンス: `200 {"ok":true,"count":<件数>,"minYear":...,"maxYear":...,...}`
- 認証なし/誤りは 401、`CRON_SECRET` 未設定は 500、CSV取得失敗は 502、パース0件は 422。
- 実行後、Supabase で `japan_holidays` の件数・年範囲、`audit_logs`（`action='system.holidays_sync'`）を確認。

---

## 📅 Vercel Cron のプラン要件

> 注: 実際の現行プランは Vercel ダッシュボード（Settings → Billing）で要確認。以下は一般的な要件。

| プラン | Cron 利用 | 実行頻度の制限 | 本機能（年1回・2/1）|
|---|---|---|---|
| **Hobby（無料）** | 利用可 | **1日1回まで**・cron job **最大2個**・実行時刻は厳密でない（その日のうちに1回）・**本番デプロイのみ** | ✅ **動作可**（年1回は「1日1回まで」の範囲内、job数1個、2月実行は時刻厳密性不要）|
| **Pro** | 利用可 | 分単位まで可・job 最大40個・スケジュール時刻に近いタイミングで実行 | ✅ 動作可 |
| **Enterprise** | 利用可 | job 最大100個 | ✅ 動作可 |

**結論**: 年1回（`0 3 1 2 *`）は **Hobby プランでも動作要件を満たす**（頻度は「1日1回以下」、job数1個）。
Hobby では実行時刻が厳密でない点があるが、**年1回・2月中に走れば十分**なので問題にならない。

**注意点（Hobby）**:
- Cron は **Production デプロイに対してのみ**実行される（Preview では走らない）。
- 実行タイミングは「指定日のうち」で、分・時は保証されない（本用途では許容）。
- もし将来 job を増やして Hobby の上限（2個・1日1回）を超える場合は Pro へ。

**代替案（現プランで動かない/制限に当たる場合）**:
- Vercel Cron を使わず、**GitHub Actions の `schedule`（cron）**から同エンドポイントを
  `Authorization: Bearer $CRON_SECRET` 付きで叩く（Secrets に CRON_SECRET を保存）。頻度制限が緩い。
- あるいは Supabase の `pg_cron` + Edge Function 等で内製する。
- いずれも本エンドポイント（認証・パース・upsert）はそのまま再利用できる。

---

## 手動ボタンについて

今回はUIボタンを作らない。将来 master 限定で「今すぐ同期」ボタンを追加する場合は、
本エンドポイントを内部呼び出しするか、同じ `fetchHolidayCsv`→`parseHolidayCsv`→upsert を
master 認可の Server Action として薄く包めばよい（ロジックは再利用可能）。
