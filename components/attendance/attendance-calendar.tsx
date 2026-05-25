import { Card, CardContent } from '@/components/ui/card'

export interface AttendanceDay {
  work_date: string         // 'YYYY-MM-DD'
  clock_in: string | null   // ISO8601
  clock_out: string | null  // ISO8601
  labor_minutes: number | null
  midnight_minutes: number | null
  over_legal_minutes: number | null
  holiday_minutes: number | null
  has_anomaly: boolean
  anomaly_codes: string[]
}

export interface AttendanceCalendarProps {
  year: number
  month: number  // 1-12
  days: AttendanceDay[]   // 当該月の attendance（必ずしも全日揃わない）
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function fmtHM(min: number | null): string {
  if (min == null) return '-'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${pad(m)}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 月別勤怠カレンダー。
 * PC (md以上): 月間グリッド表示（日曜始まり）
 * モバイル: 日別カードリスト
 */
export function AttendanceCalendar({ year, month, days }: AttendanceCalendarProps) {
  const map = new Map(days.map((d) => [d.work_date, d]))

  // 当月の 1 日と末日
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const totalDays = last.getDate()
  const firstWeekday = first.getDay() // 0=Sun

  // 月間グリッド用セル配列（前月の空欄含む）
  const cells: ({ date: string; day: number; row: AttendanceDay | undefined } | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`
    cells.push({ date, day: d, row: map.get(date) })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  // 月間合計
  const total = days.reduce(
    (acc, d) => ({
      labor: acc.labor + (d.labor_minutes ?? 0),
      overLegal: acc.overLegal + (d.over_legal_minutes ?? 0),
      midnight: acc.midnight + (d.midnight_minutes ?? 0),
      holiday: acc.holiday + (d.holiday_minutes ?? 0),
    }),
    { labor: 0, overLegal: 0, midnight: 0, holiday: 0 },
  )

  return (
    <div className="space-y-6">
      {/* サマリー */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Stat label="労働時間" value={fmtHM(total.labor)} />
          <Stat label="法定外労働" value={fmtHM(total.overLegal)} />
          <Stat label="深夜" value={fmtHM(total.midnight)} />
          <Stat label="休日労働" value={fmtHM(total.holiday)} />
        </CardContent>
      </Card>

      {/* PC: 月グリッド */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
            <div
              key={w}
              className={
                'bg-white px-2 py-2 text-center text-xs font-medium ' +
                (i === 0 ? 'text-coral' : i === 6 ? 'text-blue-500' : 'text-muted-foreground')
              }
            >
              {w}
            </div>
          ))}
          {cells.map((c, idx) => {
            if (!c) return <div key={idx} className="bg-muted/30" />
            const dow = idx % 7
            return (
              <div
                key={c.date}
                className={
                  'min-h-[88px] bg-white p-2 text-xs ' +
                  (c.row?.has_anomaly ? 'border-l-2 border-coral' : '')
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      dow === 0
                        ? 'font-medium text-coral'
                        : dow === 6
                          ? 'font-medium text-blue-500'
                          : 'font-medium text-foreground'
                    }
                  >
                    {c.day}
                  </span>
                  {c.row?.has_anomaly && (
                    <span className="rounded-full bg-coral/10 px-1.5 py-0.5 text-[10px] text-coral">
                      !
                    </span>
                  )}
                </div>
                {c.row && (
                  <div className="mt-1 space-y-0.5 text-[11px] leading-tight text-muted-foreground">
                    <div>
                      {fmtTime(c.row.clock_in)} - {fmtTime(c.row.clock_out)}
                    </div>
                    <div className="font-mono text-foreground">
                      {fmtHM(c.row.labor_minutes)}
                    </div>
                    {(c.row.midnight_minutes ?? 0) > 0 && (
                      <div className="text-purple-600">深 {fmtHM(c.row.midnight_minutes)}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* モバイル: 日別カード */}
      <div className="space-y-2 md:hidden">
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">この月の打刻データはありません。</p>
        )}
        {days.map((d) => (
          <Card key={d.work_date}>
            <CardContent className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{d.work_date}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtTime(d.clock_in)} - {fmtTime(d.clock_out)}
                </div>
                {d.has_anomaly && (
                  <div className="mt-1 text-xs text-coral">⚠ {d.anomaly_codes.join(', ')}</div>
                )}
              </div>
              <div className="text-right">
                <div className="font-mono font-semibold">{fmtHM(d.labor_minutes)}</div>
                {(d.midnight_minutes ?? 0) > 0 && (
                  <div className="text-xs text-purple-600">深 {fmtHM(d.midnight_minutes)}</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
    </div>
  )
}
