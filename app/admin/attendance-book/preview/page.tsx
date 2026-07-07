import { requireRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveVisibleScope, NO_MATCH_UUID } from '@/lib/permissions/scope'
import {
  attendanceBookQuerySchema,
  parseYearMonth,
  monthSpan,
  MAX_BOOK_MONTHS,
} from '@/lib/schemas/attendance-book'
import { fetchAttendanceBook } from '@/lib/attendance-book/query'
import { periodLabel } from '@/lib/reports/period'
import { formatJstTime, minutesToHourMinute } from '@/lib/datetime'
import type { AttendanceBookDay, AttendanceBookSheet } from '@/lib/attendance-book/layout'
import { PrintButton } from '../print-button'

/**
 * 出勤簿 印刷プレビュー
 *
 * 入力UI（/admin/attendance-book）から GET で from/to/store_id/user_ids/group_by を受け取り、
 * Excel と同じ AttendanceBookSheet を HTML 表で描画する（レイアウト定義を共有）。
 * 印刷ボタン + print: スタイル（ツールバー非表示・シート毎に改ページ・分割回避）。
 */

interface SearchParams {
  from?: string
  to?: string
  store_id?: string
  user_ids?: string | string[]
  group_by?: string
}

const HEADERS = [
  '日付',
  '曜日',
  '出勤',
  '退勤',
  '休憩',
  '労働',
  '所定内',
  '所定外',
  '深夜',
  '深夜残業',
  '法定休日',
]

function dur(min: number | null): string {
  return min == null ? '－' : minutesToHourMinute(min)
}

function timeCell(iso: string | null): string {
  return iso ? formatJstTime(iso) : '－'
}

function DayRow({ day }: { day: AttendanceBookDay }) {
  const weekendCls = day.isWeekend ? 'text-[#C0392B]' : ''
  const cells = [
    dur(day.laborMinutes),
    dur(day.scheduledInMinutes),
    dur(day.overScheduledMinutes),
    dur(day.midnightMinutes),
    dur(day.midnightOvertimeMinutes),
    dur(day.holidayMinutes),
  ]
  return (
    <tr className="border-b border-gray-200">
      <td className={`px-2 py-1 text-center ${weekendCls}`}>{day.dateLabel}</td>
      <td className={`px-2 py-1 text-center ${weekendCls}`}>{day.weekday}</td>
      <td className="px-2 py-1 text-center">{day.hasRecord ? timeCell(day.clockIn) : '－'}</td>
      <td className="px-2 py-1 text-center">{day.hasRecord ? timeCell(day.clockOut) : '－'}</td>
      <td className="px-2 py-1 text-center">{dur(day.breakMinutes)}</td>
      {cells.map((c, i) => (
        <td key={i} className="px-2 py-1 text-center">
          {c}
        </td>
      ))}
    </tr>
  )
}

function SheetView({ sheet }: { sheet: AttendanceBookSheet }) {
  const { header, days, totals } = sheet
  return (
    <section className="mb-8 rounded-lg border border-gray-300 bg-white p-5 shadow-sm print:mb-0 print:break-inside-avoid print:break-after-page print:border-0 print:p-2 print:shadow-none">
      {/* ヘッダー */}
      <div className="mb-3">
        <h2 className="text-center text-lg font-bold text-tiffany-700">
          {header.companyName}　出勤簿
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          事業所: {header.storeName}　/　従業員: {header.employeeName}
          {header.employeeNo ? `（社員番号 ${header.employeeNo}）` : ''}
          {header.jobTitle ? `　/　職種: ${header.jobTitle}` : ''}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          対象年月: {periodLabel(header.year, header.month)}
        </p>
      </div>

      {/* 明細 */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-tiffany-500 text-white">
            {HEADERS.map((h) => (
              <th key={h} className="border border-tiffany-600 px-2 py-1 font-semibold print:bg-tiffany-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <DayRow key={d.workDate} day={d} />
          ))}
          {/* 合計 */}
          <tr className="bg-[#E6F7F6] font-semibold">
            <td colSpan={5} className="px-2 py-1 text-left">
              合計（出勤 {totals.workdayCount} 日）
            </td>
            <td className="px-2 py-1 text-center">{minutesToHourMinute(totals.laborMinutes)}</td>
            <td className="px-2 py-1 text-center">{minutesToHourMinute(totals.scheduledInMinutes)}</td>
            <td className="px-2 py-1 text-center">{minutesToHourMinute(totals.overScheduledMinutes)}</td>
            <td className="px-2 py-1 text-center">{minutesToHourMinute(totals.midnightMinutes)}</td>
            <td className="px-2 py-1 text-center">
              {minutesToHourMinute(totals.midnightOvertimeMinutes)}
            </td>
            <td className="px-2 py-1 text-center">{minutesToHourMinute(totals.holidayMinutes)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-muted-foreground">
        ※「深夜」＝深夜帯(22:00-05:00)の総労働、「深夜残業」＝そのうち法定外残業に重なる分（深夜の内数）。
        打刻の無い日・休みの日は「－」で表示。
      </p>
    </section>
  )
}

export default async function AttendanceBookPreviewPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const me = await requireRole('admin')

  // --- 入力検証 ---
  const parsed = attendanceBookQuerySchema.safeParse({
    from: searchParams.from,
    to: searchParams.to,
    store_id: searchParams.store_id,
    group_by: searchParams.group_by,
  })

  let content: React.ReactNode
  if (!parsed.success) {
    content = <p className="text-sm text-destructive">入力が不正です。条件を選び直してください。</p>
  } else {
    const q = parsed.data
    const from = parseYearMonth(q.from)
    const to = parseYearMonth(q.to)
    const span = monthSpan(from, to)
    if (span === 0) {
      content = <p className="text-sm text-destructive">期間の開始が終了より後になっています。</p>
    } else if (span > MAX_BOOK_MONTHS) {
      content = (
        <p className="text-sm text-destructive">期間が長すぎます（最大 {MAX_BOOK_MONTHS} ヶ月）。</p>
      )
    } else {
      const userIds = (
        Array.isArray(searchParams.user_ids)
          ? searchParams.user_ids
          : searchParams.user_ids
            ? [searchParams.user_ids]
            : []
      ).filter((v) => v.length > 0)

      const admin = createAdminClient()
      const scope = resolveVisibleScope(me)
      let scopeStoreQuery = admin.from('stores').select('id')
      if (scope.kind === 'company') scopeStoreQuery = scopeStoreQuery.eq('company_id', scope.companyId)
      else if (scope.kind === 'store') scopeStoreQuery = scopeStoreQuery.eq('id', scope.storeId)
      else if (scope.kind !== 'all') scopeStoreQuery = scopeStoreQuery.eq('id', NO_MATCH_UUID)
      const { data: scopeStores } = await scopeStoreQuery
      const scopeStoreIds = ((scopeStores ?? []) as { id: string }[]).map((s) => s.id)

      const selectedStoreId =
        q.store_id && (scope.kind === 'all' || scopeStoreIds.includes(q.store_id)) ? q.store_id : null
      const storeId = selectedStoreId ?? (scope.kind === 'store' ? scope.storeId : null)
      const storeIds = !storeId && scope.kind === 'company' ? scopeStoreIds : null

      let sheets: AttendanceBookSheet[] = []
      let errMsg: string | null = null
      try {
        sheets = await fetchAttendanceBook(admin, {
          from,
          to,
          storeId,
          storeIds,
          userIds,
          groupBy: q.group_by,
        })
      } catch (e) {
        errMsg = e instanceof Error ? e.message : String(e)
      }

      if (errMsg) {
        content = <p className="text-sm text-destructive">出力エラー: {errMsg}</p>
      } else if (sheets.length === 0) {
        content = (
          <p className="text-sm text-muted-foreground">
            該当する従業員・期間の勤怠データがありません。
          </p>
        )
      } else {
        content = sheets.map((sheet, i) => (
          <SheetView key={`${sheet.header.employeeName}-${sheet.header.year}-${sheet.header.month}-${i}`} sheet={sheet} />
        ))
      }
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      {/* ツールバー（印刷時は非表示） */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-tiffany-700">出勤簿 印刷プレビュー</h1>
          <p className="text-sm text-muted-foreground">
            この画面をそのまま印刷できます（従業員×月ごとに改ページ）。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/attendance-book"
            className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            条件に戻る
          </a>
          <PrintButton />
        </div>
      </div>

      {content}
    </main>
  )
}
