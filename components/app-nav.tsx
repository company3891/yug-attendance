import Link from 'next/link'
import type { AppUser, UserRole } from '@/lib/database.types'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<UserRole, string> = {
  master: 'マスター',
  store: '店舗管理',
  admin: '部門管理',
  employee: '従業員',
}

type NavItem = { href: string; label: string; icon: string; requires?: UserRole }

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',         label: 'ダッシュボード', icon: '🏠' },
  { href: '/clock/qr',          label: '打刻 (QR)',       icon: '📷' },
  { href: '/me/attendance',     label: '自分の勤怠',     icon: '🕒' },
  { href: '/me/leave',          label: '有給申請',        icon: '🌴' },
  { href: '/admin/users',       label: '従業員管理',     icon: '👥', requires: 'admin' },
  { href: '/admin/users/qr',    label: 'QRコード管理',   icon: '🪪', requires: 'admin' },
  { href: '/admin/attendances', label: '打刻一覧',        icon: '📋', requires: 'admin' },
  { href: '/admin/shifts',      label: 'シフト管理',     icon: '📅', requires: 'store' },
  { href: '/admin/calendar',    label: '年間カレンダー', icon: '🗓️', requires: 'store' },
  { href: '/admin/reports',     label: 'レポート',        icon: '📊', requires: 'store' },
  { href: '/master/companies',  label: '会社管理',        icon: '🏢', requires: 'master' },
  { href: '/master/stores',     label: '店舗管理',        icon: '🏬', requires: 'master' },
]

const ROLE_RANK: Record<UserRole, number> = { master: 4, store: 3, admin: 2, employee: 1 }

function canShow(item: NavItem, role: UserRole) {
  if (!item.requires) return true
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[item.requires] ?? 0)
}

/**
 * 固定サイドバー（左、md以上で展開）。
 * モバイルでは画面上部に小さなヘッダーを表示し、サイドバー本体はオーバーレイ式（簡易版）。
 */
export function AppNav({ user }: { user: AppUser }) {
  const items = NAV_ITEMS.filter((i) => canShow(i, user.role))

  return (
    <>
      {/* Mobile top bar (md未満) */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-tiffany-500 font-bold text-white">
            Y
          </span>
          <span className="font-semibold text-tiffany-700">YUG Attendance</span>
        </Link>
        <details className="relative">
          <summary className="cursor-pointer rounded-md p-2 text-sm">☰</summary>
          <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border bg-white p-2 shadow-lg">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className="block rounded-md px-3 py-2 text-sm hover:bg-tiffany-50">
                {it.icon} {it.label}
              </Link>
            ))}
            <form action="/logout" method="post" className="mt-2 border-t pt-2">
              <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
                ログアウト
              </button>
            </form>
          </div>
        </details>
      </header>

      {/* Desktop sidebar (md以上) */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-tiffany-500 font-bold text-white">
            Y
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-tiffany-700">YUG Attendance</span>
            <span className="text-[10px] text-muted-foreground">勤怠管理</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-tiffany-50 hover:text-tiffany-700',
              )}
            >
              <span className="w-5 text-center">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-tiffany-100 font-semibold text-tiffany-700">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-lg border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              ログアウト
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
