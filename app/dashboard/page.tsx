import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkDate } from '@/lib/workTime'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ButtonClockPanel } from '@/components/clock/button-clock-panel'

type ClockStatus = 'off' | 'working' | 'on_break'

async function getClockStatus(userId: string, storeId: string | null): Promise<ClockStatus> {
  if (!storeId) return 'off'
  const supabase = createClient()
  const { data: store } = await supabase
    .from('stores')
    .select('day_start_time')
    .eq('id', storeId)
    .single()
  const dayStart = (store as { day_start_time: string } | null)?.day_start_time ?? '00:00'
  const workDate = resolveWorkDate(new Date(), dayStart)

  const { data: today } = await supabase
    .from('attendances')
    .select('clock_in, clock_out')
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .maybeSingle()

  if (!today) return 'off'
  const row = today as { clock_in: string | null; clock_out: string | null }
  if (row.clock_in && !row.clock_out) return 'working'
  return 'off'
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const clockStatus = await getClockStatus(user.id, user.store_id)
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

        {/* ボタン打刻パネル（store_id がある場合のみ表示） */}
        {user.store_id && (
          <div className="mb-6 max-w-md">
            <ButtonClockPanel currentStatus={clockStatus} />
          </div>
        )}

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
