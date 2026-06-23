# 権限：内部role名 と 表示名の対応

> 権限の**作成・編集のサーバー側防御**については `docs/account-permissions.md` を参照（service role 経由で RLS をバイパスするため明示チェックが唯一の検問）。


UI に出る日本語表示のみを変更している。**内部の role 値・序列・スコープ・権限チェックは一切変更していない。**
コードを触る際は「内部名」で判断すること（表示名に引きずられない）。

## 対応表

| 内部 role 値（不変） | 画面表示名 | 旧表示 |
|---|---|---|
| `master` | マスター | マスター（変更なし） |
| `store` | **会社** | 店舗／店舗管理／店舗管理者 |
| `admin` | **事業所** | 管理者／部門管理／部門管理者 |
| `employee` | 従業員 | 従業員（変更なし） |

## 重要な注意

- **序列は変更していない**：`master(4) > store(3) > admin(2) > employee(1)`（`lib/auth/roles.ts` の `ROLE_RANK`）。
  表示名が「会社(store) > 事業所(admin)」となり一見の上下と一致するが、**内部値は依然 store / admin**。
- `roleSatisfies` / `requireRole`、RLS ヘルパ（`is_master` / `is_store_or_above`(=master,store) / `is_admin_or_above`(=master,store,admin)）、
  `middleware.ts` のパスゲート、各種権限チェックは**未変更**。
- スコープ（store/admin が画面ごとに company/store/department 軸で食い違う件）は本タスク対象外。別タスクで扱う。

## 表示を変更した箇所（role ラベルのみ）

- `app/admin/users/page.tsx`（一覧の権限列 `ROLE_LABEL`）
- `components/app-nav.tsx`（サイドバーのユーザー権限表示 `ROLE_LABEL`）
- `components/users/user-card.tsx`（モバイルカードの権限 `ROLE_LABEL`）
- `app/admin/users/user-form.tsx`（権限レベル select の選択肢）
- `app/admin/attendances/page.tsx`（説明文の権限列挙）

## 変更していない「店舗」「部門」「会社」（= 実データ用語・ページ名）

役割ラベルではない以下は**そのまま**：
- `stores` テーブルを指す「店舗」（店舗フィルタ、所属店舗、店舗管理ページ見出し、全店舗 など）
- `departments` を指す「部門」
- `companies` を指す「会社」（フォームの会社選択フィールド `company_id` のラベル等）
- ナビの「会社管理」(`/master/companies`) / 「店舗管理」(`/master/stores`)（= 機能ページ名）
- 「管理者にご連絡ください」等の一般名詞としての“管理者”
