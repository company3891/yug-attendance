'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import { actionFail, actionOk, parseFormData, type ActionState } from '@/lib/forms/parse'
import { workRuleCreateSchema, holidaySettingsUpdateSchema } from '@/lib/schemas/settings'

export type WorkRuleState = ActionState<
  'effective_from' | 'scheduled_minutes' | 'work_start' | 'work_end' | 'break_minutes'
>
export type HolidayState = ActionState<'scheduled_holidays' | 'legal_holiday' | 'holiday_as'>

// ---------------------------------------------------------------------------
// 会社の就業設定（work_rules, scope=company）を発効日つきで追加
// ---------------------------------------------------------------------------
export async function addCompanyWorkRuleAction(
  companyId: string,
  formData: FormData,
): Promise<WorkRuleState> {
  await requireRole('master')
  const parsed = parseFormData(workRuleCreateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const admin = createAdminClient()
  const { error } = await admin.from('work_rules').insert({
    scope: 'company',
    company_id: companyId,
    store_id: null,
    effective_from: parsed.data.effective_from,
    scheduled_minutes: parsed.data.scheduled_minutes,
    work_start: parsed.data.work_start ?? null,
    work_end: parsed.data.work_end ?? null,
    break_minutes: parsed.data.break_minutes,
  } as never)
  if (error) {
    if (error.code === '23505') {
      return { ok: false, fieldErrors: { effective_from: ['同じ適用開始日の設定が既に存在します'] } }
    }
    return actionFail(error.message)
  }
  revalidatePath('/master/companies')
  return actionOk('就業設定を追加しました')
}

// ---------------------------------------------------------------------------
// 会社の休日設定（holiday_settings, scope=company）を保存（現在値・1行upsert）
// ---------------------------------------------------------------------------
export async function saveCompanyHolidaySettingsAction(
  companyId: string,
  formData: FormData,
): Promise<HolidayState> {
  await requireRole('master')
  const parsed = parseFormData(holidaySettingsUpdateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('holiday_settings')
    .select('id')
    .eq('scope', 'company')
    .eq('company_id', companyId)
    .maybeSingle()

  const values = {
    scheduled_holidays: parsed.data.scheduled_holidays,
    legal_holiday: parsed.data.legal_holiday,
    holiday_as: parsed.data.holiday_as,
  }

  const { error } = existing
    ? await admin.from('holiday_settings').update(values as never).eq('id', (existing as { id: string }).id)
    : await admin
        .from('holiday_settings')
        .insert({ scope: 'company', company_id: companyId, store_id: null, ...values } as never)
  if (error) return actionFail(error.message)

  revalidatePath('/master/companies')
  return actionOk('休日設定を保存しました')
}
