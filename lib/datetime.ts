/**
 * JST（日本標準時）固定の日時ユーティリティ（純関数）
 *
 * 設計原則（CLAUDE.md「タイムゾーン処理規約」準拠）:
 * - DB は UTC（timestamptz）。計算・UI・入出力は JST 固定。
 * - `<input type="datetime-local">` の値は TZ 情報を持たない "YYYY-MM-DDTHH:MM"。
 *   これを **JST として解釈** して UTC の Date に変換する（`jstLocalToDate`）。
 * - 逆に DB から来た Date を datetime-local の defaultValue に戻すのが `dateToJstLocal`。
 * - 表示・CSV/Excel 出力は `formatJst*` 系を使う。
 *
 * いずれも PC のローカル TZ に依存しない（Date.UTC / Intl の timeZone 指定で固定）。
 */

const JST_OFFSET_MINUTES = 9 * 60

/** "YYYY-MM-DDTHH:MM"（または ":SS" 付き）を JST と解釈して Date(UTC内部) に変換 */
export function jstLocalToDate(local: string): Date {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) {
    throw new Error(`invalid datetime-local string: ${local}`)
  }
  const [, y, mo, d, h, mi, s] = m
  // JST の壁時計時刻 → UTC は 9 時間引く。Date.UTC は分の繰り下がりを正しく処理する。
  return new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi) - JST_OFFSET_MINUTES,
      Number(s ?? 0),
    ),
  )
}

/** JST の各パーツを取り出す内部ヘルパ（Intl で TZ 固定） */
function jstParts(input: Date | string): {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  weekday: number // 0=日 .. 6=土
} {
  const d = typeof input === 'string' ? new Date(input) : input
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  // Intl は 24:00 を返すことがある（hour12:false で深夜0時 → "24"）→ "00" に正規化
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    weekday: wdMap[get('weekday')] ?? 0,
  }
}

/** Date(UTC内部) → datetime-local 用 "YYYY-MM-DDTHH:MM"（JST 壁時計） */
export function dateToJstLocal(input: Date | string): string {
  const p = jstParts(input)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** "YYYY-MM-DD HH:MM"（JST） */
export function formatJstDateTime(input: Date | string | null | undefined): string {
  if (!input) return ''
  const p = jstParts(input)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

/** "HH:MM"（JST） */
export function formatJstTime(input: Date | string | null | undefined): string {
  if (!input) return ''
  const p = jstParts(input)
  return `${p.hour}:${p.minute}`
}

/** "YYYY-MM-DD"（JST） */
export function formatJstDate(input: Date | string | null | undefined): string {
  if (!input) return ''
  const p = jstParts(input)
  return `${p.year}-${p.month}-${p.day}`
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

/** work_date("YYYY-MM-DD") を "M/D（曜）" 形式に整形（Excel/CSV 用） */
export function formatWorkDateLabel(workDate: string): string {
  const m = workDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return workDate
  const [, , mo, d] = m
  // 曜日は JST 正午で安定判定（端の時刻でも日付が動かない）
  const wd = jstParts(`${workDate}T12:00:00+09:00`).weekday
  return `${Number(mo)}/${Number(d)}（${WEEKDAY_JA[wd]}）`
}

/** work_date が土日か（土=6 / 日=0） */
export function isWeekend(workDate: string): boolean {
  const wd = jstParts(`${workDate}T12:00:00+09:00`).weekday
  return wd === 0 || wd === 6
}

/** work_date("YYYY-MM-DD") を "M/D" 形式に整形（出勤簿の日付列用・曜日は別列） */
export function formatMonthDay(workDate: string): string {
  const m = workDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return workDate
  return `${Number(m[2])}/${Number(m[3])}`
}

/** work_date("YYYY-MM-DD") の曜日ラベル（"日"〜"土"）。JST 正午で安定判定 */
export function weekdayLabel(workDate: string): string {
  const wd = jstParts(`${workDate}T12:00:00+09:00`).weekday
  return WEEKDAY_JA[wd] ?? ''
}

/** 分 → "H:MM"（労働時間表示用）。0 や null は "0:00" */
export function minutesToHourMinute(min: number | null | undefined): string {
  const v = Math.max(0, Math.round(min ?? 0))
  const h = Math.floor(v / 60)
  const m = v % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
