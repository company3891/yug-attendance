import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { AppUser } from '@/lib/database.types'

// 権限の表示ラベル（内部role名は不変。store=会社 / admin=事業所。docs/role-labels.md 参照）
const ROLE_LABEL: Record<string, string> = {
  master: 'マスター',
  store: '会社',
  admin: '事業所',
  employee: '従業員',
}

/**
 * 従業員カード（モバイル幅用）。
 * /admin/users のテーブルが縦書き化するのを避けるため、md未満でこちらに切替。
 */
export function UserCard({
  user,
  deactivateAction,
  activateAction,
}: {
  user: Pick<
    AppUser,
    'id' | 'employee_no' | 'name' | 'role' | 'job_title' | 'employment_type' | 'is_active'
  >
  deactivateAction: (userId: string) => Promise<void>
  activateAction: (userId: string) => Promise<void>
}) {
  return (
    <article className="rounded-xl border border-tiffany-100 bg-card p-4 shadow-sm">
      {/* ヘッダー: 氏名 + 状態バッジ */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{user.name}</h3>
          {user.employee_no && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">No. {user.employee_no}</p>
          )}
        </div>
        {user.is_active ? (
          <span className="shrink-0 rounded-full bg-tiffany-100 px-2.5 py-1 text-xs font-medium text-tiffany-700">
            有効
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            無効
          </span>
        )}
      </div>

      <hr className="my-3 border-tiffany-100" />

      {/* ラベル + 値の2カラムグリッド */}
      <dl className="grid grid-cols-[80px_1fr] gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">権限</dt>
        <dd>{ROLE_LABEL[user.role] ?? user.role}</dd>

        <dt className="text-muted-foreground">役職</dt>
        <dd>{user.job_title ?? '-'}</dd>

        <dt className="text-muted-foreground">雇用形態</dt>
        <dd>{user.employment_type ?? '-'}</dd>
      </dl>

      {/* 操作ボタン（タップエリア十分） */}
      <div className="mt-4 flex gap-2">
        <Link href={`/admin/users/${user.id}`} className="flex-1">
          <Button size="default" variant="outline" className="w-full">
            編集
          </Button>
        </Link>
        {user.is_active ? (
          <form action={deactivateAction.bind(null, user.id)} className="flex-1">
            <Button size="default" variant="ghost" type="submit" className="w-full">
              無効化
            </Button>
          </form>
        ) : (
          <form action={activateAction.bind(null, user.id)} className="flex-1">
            <Button size="default" variant="ghost" type="submit" className="w-full">
              有効化
            </Button>
          </form>
        )}
      </div>
    </article>
  )
}
