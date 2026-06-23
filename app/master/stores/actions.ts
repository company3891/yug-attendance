'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/roles'
import {
  actionFail,
  actionOk,
  parseFormData,
  type ActionState,
} from '@/lib/forms/parse'
import { workRuleCreateSchema, holidaySettingsUpdateSchema } from '@/lib/schemas/settings'
import type { WorkRuleState, HolidayState } from '../companies/actions'

/** 対象店舗が操作者の権限範囲か検証（master=全店、store=自社の店舗のみ） */
async function assertStoreScope(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string,
): Promise<{ ok: true; companyId: string } | { ok: false; message: string }> {
  const me = await requireRole('store')
  const { data: store } = await admin
    .from('stores')
    .select('company_id')
    .eq('id', storeId)
    .maybeSingle()
  if (!store) return { ok: false, message: '店舗が見つかりません' }
  const companyId = (store as { company_id: string }).company_id
  if (me.role !== 'master' && me.company_id !== companyId) {
    return { ok: false, message: '他社の店舗は操作できません' }
  }
  return { ok: true, companyId }
}

// ---------------------------------------------------------------------------
// 店舗の就業設定（work_rules, scope=store）を発効日つきで追加（会社デフォルトを上書き）
// ---------------------------------------------------------------------------
export async function addStoreWorkRuleAction(
  storeId: string,
  formData: FormData,
): Promise<WorkRuleState> {
  const admin = createAdminClient()
  const scope = await assertStoreScope(admin, storeId)
  if (!scope.ok) return actionFail(scope.message)

  const parsed = parseFormData(workRuleCreateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { error } = await admin.from('work_rules').insert({
    scope: 'store',
    company_id: scope.companyId,
    store_id: storeId,
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
  revalidatePath('/master/stores')
  return actionOk('店舗の就業設定を追加しました')
}

// ---------------------------------------------------------------------------
// 店舗の就業設定 上書きを全解除（store-scope の work_rules を削除→会社デフォルトに戻る）
// ---------------------------------------------------------------------------
export async function resetStoreWorkRulesAction(storeId: string): Promise<WorkRuleState> {
  const admin = createAdminClient()
  const scope = await assertStoreScope(admin, storeId)
  if (!scope.ok) return actionFail(scope.message)

  const { error } = await admin.from('work_rules').delete().eq('scope', 'store').eq('store_id', storeId)
  if (error) return actionFail(error.message)
  revalidatePath('/master/stores')
  return actionOk('就業設定の店舗上書きを解除しました（会社デフォルトを使用）')
}

// ---------------------------------------------------------------------------
// 店舗の休日設定（holiday_settings, scope=store）を保存
// ---------------------------------------------------------------------------
export async function saveStoreHolidaySettingsAction(
  storeId: string,
  formData: FormData,
): Promise<HolidayState> {
  const admin = createAdminClient()
  const scope = await assertStoreScope(admin, storeId)
  if (!scope.ok) return actionFail(scope.message)

  const parsed = parseFormData(holidaySettingsUpdateSchema, formData)
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }

  const { data: existing } = await admin
    .from('holiday_settings')
    .select('id')
    .eq('scope', 'store')
    .eq('store_id', storeId)
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
        .insert({ scope: 'store', company_id: scope.companyId, store_id: storeId, ...values } as never)
  if (error) return actionFail(error.message)

  revalidatePath('/master/stores')
  return actionOk('店舗の休日設定を保存しました')
}

// ---------------------------------------------------------------------------
// 店舗の休日設定 上書き解除（store-scope 行を削除→会社デフォルトに戻る）
// ---------------------------------------------------------------------------
export async function resetStoreHolidaySettingsAction(storeId: string): Promise<HolidayState> {
  const admin = createAdminClient()
  const scope = await assertStoreScope(admin, storeId)
  if (!scope.ok) return actionFail(scope.message)

  const { error } = await admin
    .from('holiday_settings')
    .delete()
    .eq('scope', 'store')
    .eq('store_id', storeId)
  if (error) return actionFail(error.message)
  revalidatePath('/master/stores')
  return actionOk('休日設定の店舗上書きを解除しました（会社デフォルトを使用）')
}
