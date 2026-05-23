import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const isAdminOrAbove = ['master', 'store', 'admin'].includes(user.role)
  const isStoreOrAbove = ['master', 'store'].includes(user.role)

  return (
    <>
      <AppNav user={user} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-tiffany-700">こんにちは、{user.name} さん</h1>
          <p className="text-sm text-muted-foreground">
            YUG Attendance へようこそ。下記から各機能にアクセスしてください。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            href="/me/attendance"
            title="自分の勤怠"
            description="月別の勤怠状況を確認します（Phase 2 で実装）"
          />
          <DashboardCard
            href="/me/leave"
            title="有給申請"
            description="有給休暇の申請・残日数を確認します（Phase 5）"
          />
          {isAdminOrAbove && (
            <DashboardCard
              href="/admin/users"
              title="従業員管理"
              description="従業員の追加・編集・無効化を行います"
            />
          )}
          {isStoreOrAbove && (
            <DashboardCard
              href="/admin/shifts"
              title="シフト管理"
              description="シフトカレンダーで予定を編集します（Phase 7）"
            />
          )}
          {isStoreOrAbove && (
            <DashboardCard
              href="/admin/calendar"
              title="年間カレンダー"
              description="営業カレンダーと法定休日を管理します（Phase 6）"
            />
          )}
          {user.role === 'master' && (
            <DashboardCard
              href="/master/companies"
              title="会社管理"
              description="会社情報と店舗を管理します（マスター専用）"
            />
          )}
        </div>
      </main>
    </>
  )
}

function DashboardCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block">
      <Card className="transition-transform hover:scale-[1.01]">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-sm text-tiffany-600">開く →</span>
        </CardContent>
      </Card>
    </Link>
  )
}
