import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildReportWorkbook } from './excel'
import { buildReportRow, type ReportRowInput } from './build'

const mk = (over: Partial<ReportRowInput>): ReportRowInput => ({
  userId: 'u1',
  userName: '山田太郎',
  storeName: '本店',
  workDate: '2026-06-01',
  clockIn: '2026-06-01T00:00:00.000Z', // JST 09:00
  clockOut: '2026-06-01T08:00:00.000Z', // JST 17:00
  breakMinutes: 0,
  wtc: {
    labor_minutes: 480,
    scheduled_minutes: 480,
    over_scheduled_minutes: 0,
    over_legal_minutes: 0,
    midnight_minutes: 0,
    midnight_over_minutes: 480,
    holiday_minutes: 0,
    holiday_over_minutes: 480,
  },
  wageType: 'hourly',
  hourlyWage: 1200,
  monthlyWage: null,
  dailyWage: null,
  ...over,
})

async function load(buffer: ExcelJS.Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as ArrayBuffer)
  return wb
}

describe('buildReportWorkbook', () => {
  it('従業員ごとにシート分け（userId 単位、シート名=氏名）', async () => {
    const rows = [
      buildReportRow(mk({ userId: 'u1', userName: '山田太郎', workDate: '2026-06-01' })),
      buildReportRow(mk({ userId: 'u1', userName: '山田太郎', workDate: '2026-06-02' })),
      buildReportRow(mk({ userId: 'u2', userName: '佐藤花子', workDate: '2026-06-01' })),
    ]
    const wb = await load(await buildReportWorkbook(rows, { year: 2026, month: 6, clientName: '' }))
    expect(wb.worksheets.length).toBe(2)
    expect(wb.worksheets.map((w) => w.name).sort()).toEqual(['佐藤花子', '山田太郎'])
  })

  it('同名でも userId が違えばシートを分け、名前は重複回避', async () => {
    const rows = [
      buildReportRow(mk({ userId: 'u1', userName: '田中' })),
      buildReportRow(mk({ userId: 'u2', userName: '田中' })),
    ]
    const wb = await load(await buildReportWorkbook(rows, { year: 2026, month: 6, clientName: '' }))
    expect(wb.worksheets.length).toBe(2)
    expect(wb.worksheets[1]?.name).not.toBe(wb.worksheets[0]?.name)
  })

  it('タイトルにクライアント名 / ヘッダー9列 / 当月全日 + 合計 + 概算 + 注記', async () => {
    const rows = [buildReportRow(mk({ workDate: '2026-06-01' }))]
    const wb = await load(
      await buildReportWorkbook(rows, { year: 2026, month: 6, clientName: '株式会社テスト 御中' }),
    )
    const ws = wb.worksheets[0]!
    expect(String(ws.getCell('A1').value)).toContain('株式会社テスト 御中')
    expect(String(ws.getCell('A1').value)).toContain('給与計算用 勤怠明細')
    expect(String(ws.getCell('A2').value)).toContain('2026年6月')
    // ヘッダー（行4）
    const header = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => ws.getCell(4, c).value)
    expect(header).toEqual([
      '日付', '出勤', '退勤', '労働', '所定内', '所定外', '深夜', '深夜残業', '法定休日',
    ])
    // 6月は30日 → データ行 5..34、合計行35
    expect(String(ws.getCell('A35').value)).toBe('合計')
  })

  it('合計はSUM数式（ハードコードでない）', async () => {
    const rows = [
      buildReportRow(mk({ workDate: '2026-06-01' })),
      buildReportRow(mk({ workDate: '2026-06-02' })),
    ]
    const wb = await load(await buildReportWorkbook(rows, { year: 2026, month: 6, clientName: '' }))
    const ws = wb.worksheets[0]!
    const laborTotal = ws.getCell('D35').value as ExcelJS.CellFormulaValue
    // ハードコードではなく実際の SUM 数式であること（範囲はデータ行全域）
    expect(laborTotal.formula).toContain('SUM(D5:D34)')
    // 事前計算済み result が格納されていること（[h]:mm 形式のため読戻しは Date 化される）
    expect(laborTotal.result).toBeTruthy()
  })

  it('勤務なしの日は「－」', async () => {
    const rows = [buildReportRow(mk({ workDate: '2026-06-01' }))]
    const wb = await load(await buildReportWorkbook(rows, { year: 2026, month: 6, clientName: '' }))
    const ws = wb.worksheets[0]!
    // 6/2（行6）は勤務なし → 労働(D6)が「－」
    expect(ws.getCell('D6').value).toBe('－')
  })

  it('概算支給額: 時給は合計、月給は固定額注記', async () => {
    // 時給: 8h×1200 = 9600（1日）
    const hourly = [buildReportRow(mk({ workDate: '2026-06-01' }))]
    let wb = await load(await buildReportWorkbook(hourly, { year: 2026, month: 6, clientName: '' }))
    let ws = wb.worksheets[0]!
    expect(Number(ws.getCell('I36').value)).toBe(9600)

    // 月給: 固定額
    const monthly = [
      buildReportRow(
        mk({ wageType: 'monthly', hourlyWage: null, monthlyWage: 250000, workDate: '2026-06-01' }),
      ),
    ]
    wb = await load(await buildReportWorkbook(monthly, { year: 2026, month: 6, clientName: '' }))
    ws = wb.worksheets[0]!
    expect(Number(ws.getCell('I36').value)).toBe(250000)
    expect(String(ws.getCell('A36').value)).toContain('月給固定額')
  })

  it('該当データ0件 → 案内シート1枚', async () => {
    const wb = await load(await buildReportWorkbook([], { year: 2026, month: 6, clientName: '' }))
    expect(wb.worksheets.length).toBe(1)
    expect(wb.worksheets[0]?.name).toBe('該当なし')
  })
})
