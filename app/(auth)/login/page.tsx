import { LoginForm } from './login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tiffany-50 to-white p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-tiffany-500 text-white flex items-center justify-center text-xl font-bold">
            Y
          </div>
          <CardTitle className="text-2xl text-tiffany-700">YUG Attendance</CardTitle>
          <CardDescription>勤怠管理システムにログイン</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={searchParams.next} initialError={searchParams.error} />
        </CardContent>
      </Card>
    </main>
  )
}
