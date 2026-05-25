import { describe, it, expect } from 'vitest'
import { roundClockTime } from './clockRounding'

const jst = (iso: string) => new Date(`${iso}+09:00`)

describe('roundClockTime', () => {
  // ─────────────────────────────────────────
  // 丸めなし（unit=0）: 元の時刻をそのまま返す
  // ─────────────────────────────────────────
  describe('unit=0 (丸めなし)', () => {
    it('any → そのまま', () => {
      const t = jst('2026-05-23T09:07:35')
      expect(roundClockTime(t, 0, 'up').toISOString()).toBe(t.toISOString())
      expect(roundClockTime(t, 0, 'down').toISOString()).toBe(t.toISOString())
    })
  })

  // ─────────────────────────────────────────
  // 15分単位
  // ─────────────────────────────────────────
  describe('unit=15 切上げ (up)', () => {
    it('09:00:00 → 09:00 (端数なし)', () => {
      expect(roundClockTime(jst('2026-05-23T09:00:00'), 15, 'up').toISOString()).toBe(
        jst('2026-05-23T09:00').toISOString(),
      )
    })
    it('09:00:01 → 09:15', () => {
      expect(roundClockTime(jst('2026-05-23T09:00:01'), 15, 'up').toISOString()).toBe(
        jst('2026-05-23T09:15').toISOString(),
      )
    })
    it('09:14 → 09:15', () => {
      expect(roundClockTime(jst('2026-05-23T09:14'), 15, 'up').toISOString()).toBe(
        jst('2026-05-23T09:15').toISOString(),
      )
    })
    it('09:15:00 → 09:15 (境界はそのまま)', () => {
      expect(roundClockTime(jst('2026-05-23T09:15:00'), 15, 'up').toISOString()).toBe(
        jst('2026-05-23T09:15').toISOString(),
      )
    })
    it('09:16 → 09:30', () => {
      expect(roundClockTime(jst('2026-05-23T09:16'), 15, 'up').toISOString()).toBe(
        jst('2026-05-23T09:30').toISOString(),
      )
    })
    it('23:46 → 24:00 (日付またぎ)', () => {
      expect(roundClockTime(jst('2026-05-23T23:46'), 15, 'up').toISOString()).toBe(
        jst('2026-05-24T00:00').toISOString(),
      )
    })
  })

  describe('unit=15 切下げ (down)', () => {
    it('17:00:00 → 17:00', () => {
      expect(roundClockTime(jst('2026-05-23T17:00:00'), 15, 'down').toISOString()).toBe(
        jst('2026-05-23T17:00').toISOString(),
      )
    })
    it('17:14:59 → 17:00', () => {
      expect(roundClockTime(jst('2026-05-23T17:14:59'), 15, 'down').toISOString()).toBe(
        jst('2026-05-23T17:00').toISOString(),
      )
    })
    it('17:15:00 → 17:15 (境界はそのまま)', () => {
      expect(roundClockTime(jst('2026-05-23T17:15:00'), 15, 'down').toISOString()).toBe(
        jst('2026-05-23T17:15').toISOString(),
      )
    })
    it('17:29 → 17:15', () => {
      expect(roundClockTime(jst('2026-05-23T17:29'), 15, 'down').toISOString()).toBe(
        jst('2026-05-23T17:15').toISOString(),
      )
    })
    it('17:30 → 17:30', () => {
      expect(roundClockTime(jst('2026-05-23T17:30:00'), 15, 'down').toISOString()).toBe(
        jst('2026-05-23T17:30').toISOString(),
      )
    })
  })

  // ─────────────────────────────────────────
  // 30分単位
  // ─────────────────────────────────────────
  describe('unit=30 切上げ', () => {
    it('09:00:01 → 09:30', () => {
      expect(roundClockTime(jst('2026-05-23T09:00:01'), 30, 'up').toISOString()).toBe(
        jst('2026-05-23T09:30').toISOString(),
      )
    })
    it('09:29 → 09:30', () => {
      expect(roundClockTime(jst('2026-05-23T09:29'), 30, 'up').toISOString()).toBe(
        jst('2026-05-23T09:30').toISOString(),
      )
    })
    it('09:30 → 09:30', () => {
      expect(roundClockTime(jst('2026-05-23T09:30:00'), 30, 'up').toISOString()).toBe(
        jst('2026-05-23T09:30').toISOString(),
      )
    })
    it('09:31 → 10:00', () => {
      expect(roundClockTime(jst('2026-05-23T09:31'), 30, 'up').toISOString()).toBe(
        jst('2026-05-23T10:00').toISOString(),
      )
    })
  })

  describe('unit=30 切下げ', () => {
    it('17:59 → 17:30', () => {
      expect(roundClockTime(jst('2026-05-23T17:59'), 30, 'down').toISOString()).toBe(
        jst('2026-05-23T17:30').toISOString(),
      )
    })
    it('17:00 → 17:00', () => {
      expect(roundClockTime(jst('2026-05-23T17:00:00'), 30, 'down').toISOString()).toBe(
        jst('2026-05-23T17:00').toISOString(),
      )
    })
  })

  // ─────────────────────────────────────────
  // バリデーション
  // ─────────────────────────────────────────
  describe('バリデーション', () => {
    it('未対応の unit → throw', () => {
      expect(() =>
        // @ts-expect-error 意図的に型外の値を渡してランタイム検証
        roundClockTime(jst('2026-05-23T09:00'), 7, 'up'),
      ).toThrow(/unsupported rounding unit/i)
    })
    it('未対応の direction → throw', () => {
      expect(() =>
        // @ts-expect-error 意図的に型外の値を渡してランタイム検証
        roundClockTime(jst('2026-05-23T09:00'), 15, 'nearest'),
      ).toThrow(/unsupported direction/i)
    })
  })

  // ─────────────────────────────────────────
  // 秒・ミリ秒の正規化
  // ─────────────────────────────────────────
  describe('秒・ミリ秒の扱い', () => {
    it('丸め後は秒・ミリ秒が必ず 0', () => {
      const r = roundClockTime(jst('2026-05-23T09:14:35.500'), 15, 'up')
      expect(r.getSeconds()).toBe(0)
      expect(r.getMilliseconds()).toBe(0)
    })
  })
})
