import { z } from 'zod'

/**
 * 打刻修正（Phase 4）の入力スキーマ
 *
 * - 既存の打刻レコードを直接編集する「編集専用」スキーマ。
 *   新規打刻は QR/顔/ボタン経由（lib/schemas/clock.ts）なので create は持たない。
 * - 入力は `<input type="datetime-local">` の "YYYY-MM-DDTHH:MM" 文字列（TZなし=JST解釈）。
 *   JST→UTC 変換は Server Action 側で `jstLocalToDate()` を使う。
 * - clock_out は任意（出勤中で未退勤のレコードもありうる）。
 * - clock_out > clock_in のクロスフィールド検証はここで実施（文字列の辞書順比較で十分）。
 * - 「未来時刻禁止」は now 依存のため Server Action 側で検証する。
 */

const empty = (v: unknown) => (v === '' || v === null ? undefined : v)

// "YYYY-MM-DDTHH:MM"（datetime-local）。秒は任意。
const datetimeLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, '日時の形式が不正です')

export const attendanceUpdateSchema = z
  .object({
    clock_in: datetimeLocal,
    clock_out: z.preprocess(empty, datetimeLocal.optional()),
    break_minutes: z.preprocess(
      empty,
      z.coerce.number().int().min(0, '休憩時間は0以上で入力してください').optional(),
    ),
  })
  .superRefine((val, ctx) => {
    if (val.clock_out && val.clock_out <= val.clock_in) {
      ctx.addIssue({
        code: 'custom',
        path: ['clock_out'],
        message: '退勤時刻は出勤時刻より後にしてください',
      })
    }
  })

export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>
