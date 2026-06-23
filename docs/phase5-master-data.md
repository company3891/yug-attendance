# Phase 5: 設定・マスタの土台（就業設定 / 休日 / 祝日 / 給与単価）

タグ: `v0.5.0-phase5-master-data`　前提: `v0.4.0-phase4-complete`

勤怠計算を会社ごとの実態で正しく行うための設定・マスタ台帳を整備したフェーズ。
`dayType='workday'` 固定・所定の直読みを廃し、台帳由来の所定/日種別で `work_time_calculations` を更新する。
**過去の勤怠計算は遡って書き換えない**（設定は発効日つき＝その日以降の計算にのみ反映）。

---

## ⚠️ 申し送り（後でDB適用する自分へ）

### 1. 現状：コード・テスト完成済み・DB未適用
このフェーズのコード／テストは完成（緑）しているが、**マイグレーション 0008–0010 はまだどのDBにも適用していない**。
設定画面（会社/店舗/従業員）で値を**保存・確認できるのは `supabase db push` 後**。適用前はリゾルバが
安全側の既定（所定480分 / dayType=workday）にフォールバックするため、従来どおりの挙動を維持する。

### 2. 本番 `db push` 前の必須チェック
1. **0009 の 2027年 春分(3/21)・秋分(9/23) は暫定値**。内閣府公式の祝日データ（国民の祝日CSV）と
   突合して確定してから適用する（春分/秋分は前年2月の官報で正式決定）。
2. **本番DBのバックアップを取得**してから適用する。
3. **営業時間外・打刻が走っていない時間帯に適用**する。0010 backfill が
   全既存レコード（company/store/user）に既定値を生成するため、打刻と競合させない。

### 3. `db push` 後は型の正規再生成までがワンセット
`lib/database.types.generated.ts` の Phase 5 ブロックは**一時手書き補完**。適用後に
`npm run db:types`（`supabase gen types`）で正規再生成し、手書きブロックを上書きすること。

### 4. store ロールの自店設定編集入口は未実装
店舗設定は現状 `/master/stores`（master限定）でのみ編集可。`/master/*` は middleware で master 限定のため
store ロールは到達できない。将来 `/admin` 側に入口を追加すれば、店舗向け Server Actions（store スコープ対応済み）
をそのまま使える。本フェーズは「master が全店設定」で運用。

---

## データモデル（migration 0008–0010）

| テーブル | 種別 | 用途 |
|---|---|---|
| `work_rules` | 発効日つき履歴 | 就業設定（所定/始業/終業/休憩）。scope=company/store |
| `holiday_settings` | 現在値（1対象1行） | 所定休日の曜日 / 法定休日の曜日 / 祝日の扱い。scope=company/store |
| `japan_holidays` | マスタ（全社共通） | 日本の祝日（2026・2027 seed 同梱、cao.go.jp非接続） |
| `user_wage_history` | 発効日つき履歴 | 給与単価・業務内容 |

- 既存カラムは**温存**し新台帳を「正」とする：`stores.scheduled_daily_minutes` / `stores.closed_days` /
  `users.{hourly,monthly,daily}_wage` / `users.daily_work_minutes`。
- **個人別の所定上書き**は新列を作らず既存 `users.daily_work_minutes` を流用。
- 0010 backfill は既存レコードへ `effective_from='2020-01-01'` で既定値を生成（冪等・既存値を引き継ぐ）。
  wage_type 未設定ユーザーは wage 履歴を作らず「給与種別: 未設定」を維持。

## 解決ロジック（純関数 + リゾルバ）

- `lib/calendar/dayType.ts` `resolveDayType`：曜日→**法定優先**→所定→祝日扱い→平日
- `lib/settings/workRules.ts` `resolveWorkRule`：store→company フォールバック、`effective_from<=D` の最新
  ／`effectiveScheduledMinutes`：個人別上書き優先
- `lib/settings/wage.ts` `resolveWage`/`latestWage`：発効日最新／現在値同期用
- `lib/settings/server.ts` `resolveDayCalcSettings`：**settings系DBに触る唯一の層**。上記純関数に委譲して
  `{ scheduledMinutes, dayType }` を返す。

### 計算経路の配線（4経路すべて台帳由来に統一）
`app/api/clock/route.ts`（QR）/ `app/api/clock/face/route.ts`（顔API）/
`lib/actions/face.ts`（顔action）/ `app/admin/attendances/actions.ts`（打刻修正）。
→ DB適用後は **lib/reports は無改修のまま**、レポートが台帳由来の正しい数値を出す。

## 設定UI
- 会社設定: `app/master/companies`（master）— 就業設定（履歴+追加）/ 休日設定
- 店舗設定: `app/master/stores`（master）— 会社デフォルト上書き、「上書き中/デフォルト使用中」表示+解除
- 従業員: `app/admin/users/[id]` の「給与・勤怠設定」タブ（master/store）— 給与種別/所定上書き/単価履歴
- 共有部品: `components/settings/{work-rule-editor,holiday-settings-editor}.tsx`

## 監査
- 給与種別・所定・単価の変更は `audit_logs` に `user.wage_change`（before/after）を記録。

## テスト
- 純関数: dayType（法定優先/祝日扱い/境界）/ workRules（フォールバック/発効日境界）/ wage（境界）
- リゾルバ: DBモックで resolveDayCalcSettings→calcWorkTimeBreakdown の実データ経路（所定変更で境界が動く）
- スキーマ: settings 4スキーマ
- `TZ=Asia/Tokyo npm run test` → 257 passed（既存203 + Phase5 +54）

## スコープ外（後フェーズ）
- フレックス/変形労働、シフト制の法定休日（B方式）→ Phase 7 以降
- 週またぎ・月またぎの週40h厳密判定 → 別途
- 有給管理 → Phase 6
- 期間指定・一括再計算（任意機能）→ 今フェーズ未実装
