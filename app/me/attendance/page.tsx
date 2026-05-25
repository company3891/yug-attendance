import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Button } from '@/components/ui/button'
import { AttendanceCalendar, type AttendanceDay } from '@/components/attendance/attendance-calendar'

interface SearchParams {
  year?: string
  month?: string
}

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const now = new Date()
  const year = Number(searchParams.year ?? now.getFullYear())
  const month = Number(searchParams.month ?? now.getMonth() + 1)

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  const supabase = createClient()
  const { data: rows } = await supabase
    .from('attendances')
    .select(
      'id, work_date, clock_in, clock_out, has_anomaly, anomaly_codes, work_time_calculations(labor_minutes, midnight_minutes, over_legal_minutes, holiday_minutes)',
    )
    .eq('user_id', me.id)
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: true })

  const days: AttendanceDay[] = (rows ?? []).map((row) => {
    const r = row as unknown as {
      work_date: string
      clock_in: string | null
      clock_out: string | null
      has_anomaly: boolean
      anomaly_codes: string[]
      work_time_calculations:
        | {
            labor_minutes: number | null
            midnight_minutes: number | null
            over_legal_minutes: number | null
            holiday_minutes: number | null
          }
        | Array<{
            labor_minutes: number | null
            midnight_minutes: number | null
            over_legal_minutes: number | null
            holiday_minutes: number | null
          }>
        | null
    }
    const wtc = Array.isArray(r.work_time_calculations)
      ? r.work_time_calculations[0]
      : r.work_time_calculations
    return {
      work_date: r.work_date,
      clock_in: r.clock_in,
      clock_out: r.clock_out,
      labor_minutes: wtc?.labor_minutes ?? null,
      midnight_minutes: wtc?.midnight_minutes ?? null,
      over_legal_minutes: wtc?.over_legal_minutes ?? null,
      holiday_minutes: wtc?.holiday_minutes ?? null,
      has_anomaly: r.has_anomaly ?? false,
      anomaly_codes: r.anomaly_codes ?? [],
    }
  })

  // 前月・翌月リンク
  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevHref = `/me/attendance?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`
  const nextHref = `/me/attendance?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`

  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-tiffany-700">自分の勤怠</h1>
            <p className="text-sm text-muted-foreground">
              {year}年 {month}月
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={prevHref}>
              <Button variant="outline" size="sm">
                ← 前月
              </Button>
            </Link>
            <Link href={nextHref}>
              <Button variant="outline" size="sm">
                翌月 →
              </Button>
            </Link>
            <Link href="/clock/qr">
              <Button size="sm">打刻する</Button>
            </Link>
          </div>
        </div>

        <AttendanceCalendar year={year} month={month} days={days} />
      </main>
    </>
  )
}
