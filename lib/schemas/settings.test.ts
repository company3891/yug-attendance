import { describe, it, expect } from 'vitest'
import {
  workRuleCreateSchema,
  holidaySettingsUpdateSchema,
  wageHistoryCreateSchema,
  userWageSettingsUpdateSchema,
} from './settings'

describe('workRuleCreateSchema', () => {
  it('正常', () => {
    const r = workRuleCreateSchema.safeParse({
      effective_from: '2026-06-01',
      scheduled_minutes: '480',
      work_start: '09:00',
      work_end: '18:00',
      break_minutes: '60',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.scheduled_minutes).toBe(480)
  })
  it('break 空欄は0', () => {
    const r = workRuleCreateSchema.safeParse({
      effective_from: '2026-06-01',
      scheduled_minutes: '480',
      break_minutes: '',
    })
    expect(r.success && r.data.break_minutes).toBe(0)
  })
  it('effective_from 必須・形式', () => {
    expect(workRuleCreateSchema.safeParse({ scheduled_minutes: '480' }).success).toBe(false)
    expect(
      workRuleCreateSchema.safeParse({ effective_from: '2026/06/01', scheduled_minutes: '480' })
        .success,
    ).toBe(false)
  })
  it('所定0や1440超はエラー', () => {
    expect(
      workRuleCreateSchema.safeParse({ effective_from: '2026-06-01', scheduled_minutes: '0' })
        .success,
    ).toBe(false)
    expect(
      workRuleCreateSchema.safeParse({ effective_from: '2026-06-01', scheduled_minutes: '1441' })
        .success,
    ).toBe(false)
  })
  it('終業<=始業はエラー', () => {
    const r = workRuleCreateSchema.safeParse({
      effective_from: '2026-06-01',
      scheduled_minutes: '480',
      work_start: '18:00',
      work_end: '09:00',
    })
    expect(r.success).toBe(false)
  })
})

describe('holidaySettingsUpdateSchema', () => {
  it('CSV "0,6" を [0,6] に変換', () => {
    const r = holidaySettingsUpdateSchema.safeParse({
      scheduled_holidays: '0,6',
      legal_holiday: '0',
      holiday_as: 'scheduled_holiday',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.scheduled_holidays).toEqual([0, 6])
  })
  it('空文字は空配列', () => {
    const r = holidaySettingsUpdateSchema.safeParse({
      scheduled_holidays: '',
      legal_holiday: '0',
      holiday_as: 'workday',
    })
    expect(r.success && r.data.scheduled_holidays).toEqual([])
  })
  it('legal_holiday 範囲外はエラー', () => {
    expect(
      holidaySettingsUpdateSchema.safeParse({
        scheduled_holidays: '6',
        legal_holiday: '7',
        holiday_as: 'scheduled_holiday',
      }).success,
    ).toBe(false)
  })
  it('holiday_as 不正値はエラー', () => {
    expect(
      holidaySettingsUpdateSchema.safeParse({
        scheduled_holidays: '6',
        legal_holiday: '0',
        holiday_as: 'foo',
      }).success,
    ).toBe(false)
  })
})

describe('wageHistoryCreateSchema', () => {
  it('正常', () => {
    const r = wageHistoryCreateSchema.safeParse({
      effective_from: '2026-06-01',
      unit_wage: '1200',
      job_description: 'ホール',
    })
    expect(r.success && r.data.unit_wage).toBe(1200)
  })
  it('業務内容空欄OK', () => {
    const r = wageHistoryCreateSchema.safeParse({
      effective_from: '2026-06-01',
      unit_wage: '1200',
      job_description: '',
    })
    expect(r.success && r.data.job_description).toBeUndefined()
  })
  it('単価負値はエラー', () => {
    expect(
      wageHistoryCreateSchema.safeParse({ effective_from: '2026-06-01', unit_wage: '-1' }).success,
    ).toBe(false)
  })
})

describe('userWageSettingsUpdateSchema', () => {
  it('wage_type + 所定上書き', () => {
    const r = userWageSettingsUpdateSchema.safeParse({
      wage_type: 'hourly',
      scheduled_override_minutes: '360',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.wage_type).toBe('hourly')
      expect(r.data.scheduled_override_minutes).toBe(360)
    }
  })
  it('両方空欄OK（未設定維持）', () => {
    const r = userWageSettingsUpdateSchema.safeParse({
      wage_type: '',
      scheduled_override_minutes: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.wage_type).toBeUndefined()
      expect(r.data.scheduled_override_minutes).toBeUndefined()
    }
  })
  it('wage_type 不正値はエラー', () => {
    expect(userWageSettingsUpdateSchema.safeParse({ wage_type: 'weekly' }).success).toBe(false)
  })
})
