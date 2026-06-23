# Phase 4: 打刻修正・レポート出力（CSV/Excel）

タグ: `v0.4.0-phase4-complete`

飲食業界向けの現場機動性を重視し、打刻ミスをその場で修正でき、給与計算に使える勤怠レポートを
CSV / Excel で出力できるようにした Phase。

---

## 1. 打刻修正

### 画面
- **`/admin/attendances`（打刻一覧）** — 新規作成。サイドバー「打刻一覧」。
- フィルタ: 月 / 店舗（masterのみ）/ 個人。前月・翌月リンク。
- デスクトップ=テーブル、モバイル=カード（レスポンシブ規約準拠）。
- 各行の「編集」→ モーダルで `出勤 / 退勤 / 休憩(分)` を修正。

### 権限（`lib/permissions/attendance.ts` の `canEditAttendance`）
| ロール | 範囲 |
|---|---|
| master | 全店舗 |
| store / admin | 自店舗のみ |
| employee | 不可 |

### 保存処理（`app/admin/attendances/actions.ts`）
`updateAttendanceAction(attendanceId, formData)`:
1. `requireRole('admin')`（employee 除外）
2. `parseFormData(attendanceUpdateSchema, …)`（safeParse 内蔵）
3. before 取得 → 店舗スコープ検証（`canEditAttendance`）
4. JST→UTC 変換（`jstLocalToDate`）+ 未来時刻禁止
5. `attendances` UPDATE（`modified_by` / `modified_at` も記録）
6. **`work_time_calculations` 再計算**（`lib/workTime.ts` の `calcWorkTimeBreakdown` を再利用、二重実装なし）
   - `dayType` は打刻ルートと同じく `'workday'` 固定（法定/所定休日判定は Phase 6 の年間カレンダー依存）
   - 未退勤（clock_out 空欄）の場合は wtc を 0 にリセット
7. **`audit_logs` 記録**: `action='attendance.edit'` / `auth_method='manual_edit'` / `before_data` / `after_data`

### バリデーション（`lib/schemas/attendance.ts`）
- `clock_out > clock_in`（schema + Action 二重ガード）
- 未来時刻禁止（Action 側、now 依存のため）
- DB=UTC / 入力・表示=JST 固定

---

## 2. レポート出力（全項目入り1種類）

勤怠一覧用と給与計算用の区別は廃止し、**全項目入りの1フォーマット**に統一。CSV / Excel から選択。

### 画面
- **`/admin/reports`** — 新規作成。サイドバー「レポート」（admin 以上）。
- フィルタ: 年月 / 店舗（masterは全店、store/adminは自店固定）/ 個人 / 形式(CSV/Excel) / **クライアント名**（Excel ヘッダーに差し込み）。

### 出力エンドポイント
`GET /api/reports?year=&month=&store_id=&user_id=&format=csv|excel&client_name=`
- 認可: admin 以上。非master は自店舗に強制スコープ。
- データ取得は `lib/reports/query.ts`（CSV/Excel 共用）。

### 全項目（15列）
```
従業員名, 店舗, 勤務日, 出勤, 退勤, 労働時間, 所定内, 所定外, 法定外残業,
深夜, 深夜残業, 法定休日, 給与種別, 単価, 概算支給額
```

#### 列と `work_time_calculations`(8項目) の対応
| 列 | 由来 |
|---|---|
| 労働時間 | `labor_minutes` |
| 所定内 | `labor − over_scheduled`（派生） |
| 所定外 | `over_scheduled_minutes` |
| 法定外残業 | `over_legal_minutes` |
| 深夜 | `midnight_minutes`（深夜帯22-5時の総労働） |
| 深夜残業 | **`calcMidnightOvertimeMinutes`**（深夜 ∩ 法定外残業、深夜列の**内数**） |
| 法定休日 | `holiday_minutes` |

> ⚠️ `midnight_over_minutes`（仕様書5-2「深夜割増**外**労働時間」= 労働−深夜）は**別物**で、レポートには使わない（温存）。
> 「深夜残業」は深夜帯かつ法定外残業に重なる時間（割増50%＝法定外25%+深夜25%枠）で、**深夜列の内数**。
> 残業は勤務後半に発生する前提で算出。夜勤（深夜が前半・残業が早朝）では深夜残業は0になる（テスト F7/F8 で固定）。

### 概算支給額（`lib/reports/build.ts` の `estimatePay`）
- **時給** = 所定内×時給 + 所定外×時給×1.25 + 深夜×時給×0.25 + 法定休日×時給×0.35
- **日給** = 実労働ありの日 × 日給
- **月給** = per-row では算出せず（固定額）。Excel では月額固定として表示・注記。
- 深夜残業列は表示・検算専用で**金額計算には不使用**（深夜割増は `midnight_minutes` のみ）。

### CSV（`lib/reports/csv.ts`）
- **UTF-8 BOM 付き**（Excel で文字化けしない）・**CRLF**・**JST**・CSVエスケープ対応
- `Content-Disposition: attachment`、ファイル名に期間（例 `勤怠レポート_2026-06.csv`、RFC5987）

### Excel（`lib/reports/excel.ts`・exceljs）
見本「給与計算用_見本_2026-06.xlsx」準拠:
- 1ファイル=1期間、**従業員ごとにシート分け**（シート名=氏名、31字制限・重複回避、`userId` 単位）
- 各シート: タイトル（クライアント名差し込み）/ 対象期間・店舗・氏名 / 給与種別 / 9列ヘッダー /
  当月**全日**の明細（勤務なしは「－」）/ 合計 / 概算支給額 / 注記
- デザイン: ヘッダー #0ABAB5（白字）、交互背景 #F5FAFA、合計 #E6F7F6、概算 #FFF6E6、土日赤字 #C0392B、Meiryo、罫線、gridline 非表示
- 時間項目は Excel 時刻シリアル + `[h]:mm` 形式、**合計は実 SUM 数式**（ハードコードなし／数式エラーゼロ）
- 金額は `¥#,##0` 形式

---

## 主なファイル
```
app/admin/attendances/{page,actions,attendance-table}.tsx   打刻一覧・編集
app/admin/reports/page.tsx                                  レポート画面
app/api/reports/route.ts                                    CSV/Excel 出力
lib/datetime.ts                                             JST↔UTC・整形（純関数）
lib/permissions/attendance.ts                              canEditAttendance（純関数）
lib/schemas/{attendance,report}.ts                         入力検証スキーマ
lib/i18n/anomaly.ts                                         打刻異常コードの表示文言
lib/reports/{build,csv,excel,query,period}.ts              レポート生成（純関数 + 取得）
lib/workTime.ts: calcMidnightOvertimeMinutes               深夜∩法定外残業（追加）
```

## テスト
- 純関数中心に網羅（datetime / permission / schema / workTime(F1-F8) / reports build・csv・period・excel）
- Excel はバイナリを書き出し exceljs で再読込して構造・合計・人別シートを検証
- `TZ=Asia/Tokyo npm run test` で **203 passed**

## 既知の制限・今後
- `dayType` は `'workday'` 固定（法定/所定休日の自動判定は Phase 6 の年間カレンダー実装後）
- audit_logs のうち本 Phase は打刻修正のみ実装。有効化/無効化・給与変更・権限変更・マスター操作は別途。
- CSV の時間項目は `H:MM` 表記（給与ソフトが小数時間を要する場合は別途検討）。
