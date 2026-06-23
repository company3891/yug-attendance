# アカウント作成・編集の権限防御（申し送り）

関連: `lib/permissions/userManagement.ts` / `app/admin/users/actions.ts` / 表示名は `docs/role-labels.md`

## ⚠️ 最重要の申し送り

**`createUserAction` と `updateUserAction` は service role（`createAdminClient()`）で users テーブルを
INSERT / UPDATE するため、RLS（`users_insert` / `users_update` ポリシー）をバイパスする。**

したがって、これらの経路では **`canManageExistingUser()` と `authorizeUserAssignment()` の明示チェックが
唯一の権限検問**になっている。RLS は効かない。

👉 **今後この2つのアクション（およびユーザーの role/所属を書き換える新規経路）を触る際は、
必ず明示チェックを通すこと。** 明示チェックを外す＝権限昇格・他社/他事業所ユーザー掌握の穴が即座に開く。

- 特に `updateUserAction` は元々 `createClient()`（RLS依存）だったが、
  admin(事業所) が自事業所内ユーザーを編集できるようにするため service role 経由へ変更済み。
  RLS という保険が無くなった分、明示チェックがすべてを担保している。

## 防御の構成（純関数に集約・テスト先行）

`lib/permissions/userManagement.ts`（DBアクセスなし・`lib/permissions/userManagement.test.ts` で網羅）:

| 関数 | 役割 |
|---|---|
| `canAssignRole(actorRole, targetRole)` | 付与role上限。master=無制約 / 他は厳密に下位のみ（store→admin,employee / admin→employee） |
| `authorizeUserAssignment({actor, requested, lookups})` | role上限 + 所属正規化。master=passthrough / store=company自社に上書き＋店舗・部門の自社所属検証 / admin=company/store/department を自所属に上書き |
| `canManageExistingUser({actor, existing})` | 編集対象が管轄内かつ下位か（同格以上・他社・他事業所の編集を拒否） |

> 内部role名と表示名（store=会社 / admin=事業所）・序列は `docs/role-labels.md` 参照。判定は内部role値で行う。

## 各アクションの検問順序

### createUserAction（`app/admin/users/actions.ts`）
1. `requireRole('admin')`（employee 排除）
2. `authorizeUserAssignment(...)` → role上限 + 所属正規化（他社company_idは自社上書き / 他社store_id・department_idは拒否 / 上位role付与は拒否）
3. **正規化値**で Auth作成 → users INSERT（role/company_id/store_id/department_id は decision の値で上書き）

### updateUserAction（`app/admin/users/actions.ts`）
1. `requireRole('admin')`
2. 既存ユーザーを取得 → `canManageExistingUser(...)`（同格以上の降格・他社/他事業所の掌握を拒否）
3. `authorizeUserAssignment(...)`（変更後の role昇格・所属付け替えを拒否）
4. **正規化値**で users UPDATE（service role）

## 触るときのチェックリスト
- [ ] role を書き換える経路か？ → `authorizeUserAssignment` を通したか
- [ ] 既存ユーザーを編集する経路か？ → `canManageExistingUser` を先に通したか
- [ ] service role / admin client を使っているか？ → RLSは効かない前提で明示チェック必須
- [ ] INSERT/UPDATE には**フォーム値ではなく decision の正規化値**を使ったか
- [ ] 不正細工パターン（他社id・上位role・範囲外department）のテストを追加・維持したか

## 可視スコープ（見える範囲）の統一 — 実装済み
- role別「見える範囲」は `lib/permissions/scope.ts` の `resolveVisibleScope(me)` に集約済み:
  master=全社 / 会社(store)=自社全店 / 事業所(admin)=自店舗(store_id)配下 / employee=自分のみ。
- 従業員一覧・QR管理・打刻一覧・レポート（route/画面）・打刻修正可否（`canEditAttendance`）が
  すべてこの基準を参照。**新しい一覧/絞り込み経路を足すときは `resolveVisibleScope` を使うこと**（画面ごとにバラつかせない）。
- 会社/事業所には「事業所で絞る」ドロップダウンを開放（master既存の仕組みを流用）。絞り込みはUI利便で、
  根底の可視範囲はサーバー側 `resolveVisibleScope` が担保。
- 会社・事業所・部門そのものの作成機能は未実装（migration/seed のみ）。実装する場合も同様に明示チェックを設けること。
