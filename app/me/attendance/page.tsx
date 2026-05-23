import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MyAttendancePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return (
    <>
      <AppNav user={user} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <Card>
          <CardHeader>
            <CardTitle>自分の勤怠</CardTitle>
            <CardDescription>Phase 2 で月別カレンダー表示を実装します。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">準備中。</p>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
