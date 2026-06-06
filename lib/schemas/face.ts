import { z } from 'zod'

/** 顔認証設定の更新（管理者 or 本人） */
export const faceAuthToggleSchema = z.object({
  user_id: z.string().uuid(),
  face_auth_enabled: z.enum(['true', 'false']).transform((v) => v === 'true'),
})
export type FaceAuthToggleInput = z.infer<typeof faceAuthToggleSchema>

/** 顔データ登録（本人のみ） */
export const faceRegisterSchema = z.object({
  user_id: z.string().uuid(),
  // JSON文字列で受け取り、パース後に number[][] を検証
  descriptors_json: z
    .string()
    .min(1)
    .transform((v, ctx) => {
      try {
        const parsed = JSON.parse(v)
        if (
          !Array.isArray(parsed) ||
          parsed.length === 0 ||
          !parsed.every(
            (d: unknown) =>
              Array.isArray(d) &&
              d.length === 128 &&
              (d as unknown[]).every((n) => typeof n === 'number'),
          )
        ) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: '特徴ベクトルの形式が不正です' })
          return z.NEVER
        }
        return parsed as number[][]
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'JSONパースに失敗しました' })
        return z.NEVER
      }
    }),
  image_consent: z.enum(['true', 'false']).transform((v) => v === 'true'),
})
export type FaceRegisterInput = z.infer<typeof faceRegisterSchema>

/** 顔データリセット（管理者専用） */
export const faceResetSchema = z.object({
  user_id: z.string().uuid(),
})
export type FaceResetInput = z.infer<typeof faceResetSchema>

/** 音声読み上げ設定の更新（本人 or 管理者） */
export const voiceSettingSchema = z.object({
  user_id: z.string().uuid(),
  voice_announcement_enabled: z
    .enum(['true', 'false', 'null'])
    .transform((v) => (v === 'null' ? null : v === 'true')),
})
export type VoiceSettingInput = z.infer<typeof voiceSettingSchema>
