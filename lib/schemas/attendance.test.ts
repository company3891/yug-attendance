import { describe, it, expect } from 'vitest'
import { attendanceUpdateSchema } from './attendance'

describe('attendanceUpdateSchema', () => {
  it('正常: clock_in / clock_out / break_minutes', () => {
    const r = attendanceUpdateSchema.safeParse({
      clock_in: '2026-06-23T09:00',
      clock_out: '2026-06-23T18:00',
      break_minutes: '60',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.break_minutes).toBe(60)
    }
  })

  it('clock_out 空欄は許可（出勤中）', () => {
    const r = attendanceUpdateSchema.safeParse({
      clock_in: '2026-06-23T09:00',
      clock_out: '',
      break_minutes: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.clock_out).toBeUndefined()
      expect(r.data.break_minutes).toBeUndefined()
    }
  })

  it('clock_out <= clock_in はエラー', () => {
    const r = attendanceUpdateSchema.safeParse({
      clock_in: '2026-06-23T18:00',
      clock_out: '2026-06-23T09:00',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.clock_out?.[0]).toContain('後にして')
    }
  })

  it('clock_out == clock_in はエラー', () => {
    const r = attendanceUpdateSchema.safeParse({
      clock_in: '2026-06-23T09:00',
      clock_out: '2026-06-23T09:00',
    })
    expect(r.success).toBe(false)
  })

  it('clock_in 不正形式はエラー', () => {
    const r = attendanceUpdateSchema.safeParse({ clock_in: '2026/06/23 09:00' })
    expect(r.success).toBe(false)
  })

  it('clock_in 必須', () => {
    const r = attendanceUpdateSchema.safeParse({ clock_out: '2026-06-23T18:00' })
    expect(r.success).toBe(false)
  })

  it('break_minutes 負値はエラー', () => {
    const r = attendanceUpdateSchema.safeParse({
      clock_in: '2026-06-23T09:00',
      clock_out: '2026-06-23T18:00',
      break_minutes: '-10',
    })
    expect(r.success).toBe(false)
  })

  it('日付またぎ（翌日退勤）は許可', () => {
    const r = attendanceUpdateSchema.safeParse({
      clock_in: '2026-06-23T22:00',
      clock_out: '2026-06-24T02:00',
    })
    expect(r.success).toBe(true)
  })
})
