'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { UserActionState } from '@/lib/schemas/user'
import { WAGE_RANGE, isWageInRange, type WageType } from '@/lib/schemas/user'

type FieldErrors = Record<string, string[] | undefined>

export interface UserFormDefaults {
  email?: string
  name?: string
  name_kana?: string
  employee_no?: string
  role?: 'master' | 'store' | 'admin' | 'employee'
  job_title?: string
  employment_type?: string
  hire_date?: string
  wage_type?: 'hourly' | 'monthly' | 'daily' | ''
  hourly_wage?: number | string
  monthly_wage?: number | string
  daily_wage?: number | string
  is_active?: boolean
  company_id?: string
  store_id?: string
  department_id?: string
}

/** フィールド直下にエラーを出す共通コンポーネント */
function ErrorMsg({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return (
    <p role="alert" className="text-xs text-destructive">
      {errors[0]}
    </p>
  )
}

export function UserForm({
  action,
  defaults,
  mode,
  companies,
  stores,
  departments,
  currentUserRole,
}: {
  action: (formData: FormData) => Promise<UserActionState>
  defaults?: UserFormDefaults
  mode: 'create' | 'edit'
  companies: { id: string; name: string }[]
  stores: { id: string; name: string; company_id: string }[]
  departments: { id: string; name: string; store_id: string }[]
  currentUserRole: 'master' | 'store' | 'admin' | 'employee'
}) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [wageType, setWageType] = useState<'hourly' | 'monthly' | 'daily' | ''>(
    defaults?.wage_type ?? '',
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    const formData = new FormData(e.currentTarget)

    // 給与範囲外チェック → confirm ダイアログ（範囲外でも保存可だが警告）
    if (wageType && (wageType === 'hourly' || wageType === 'monthly' || wageType === 'daily')) {
      const fieldName = `${wageType}_wage` as const
      const raw = formData.get(fieldName)
      if (raw && raw !== '') {
        const amount = Number(raw)
        if (!Number.isNaN(amount) && !isWageInRange(wageType as WageType, amount)) {
          const r = WAGE_RANGE[wageType as WageType]
          const ok = window.confirm(
            `${r.label}「${amount.toLocaleString()}円」は推奨範囲（${r.min.toLocaleString()}〜${r.max.toLocaleString()}円）の外です。\nこのまま保存しますか？`,
          )
          if (!ok) return
        }
      }
    }

    startTransition(async () => {
      const result = await action(formData)
      if (!result || result.ok) return
      if (result.formError) setFormError(result.formError)
      if (result.fieldErrors) setFieldErrors(result.fieldErrors as FieldErrors)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold text-tiffany-700">基本情報</h2>

        {mode === 'create' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス（ログインID） *</Label>
              <Input id="email" name="email" type="email" required defaultValue={defaults?.email} />
              <ErrorMsg errors={fieldErrors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード *</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
              <ErrorMsg errors={fieldErrors.password} />
            </div>
          </>
        ) : (
          <div className="md:col-span-2 space-y-2">
            <Label>メールアドレス（変更不可）</Label>
            <Input value={defaults?.email ?? ''} disabled />
            <p className="text-xs text-muted-foreground">
              メール変更は別フロー、パスワードはページ下部「パスワード変更」で行います。
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">氏名 *</Label>
          <Input id="name" name="name" required defaultValue={defaults?.name} />
          <ErrorMsg errors={fieldErrors.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_kana">氏名カナ</Label>
          <Input id="name_kana" name="name_kana" defaultValue={defaults?.name_kana} />
          <ErrorMsg errors={fieldErrors.name_kana} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee_no">従業員ナンバー</Label>
          <Input
            id="employee_no"
            name="employee_no"
            defaultValue={defaults?.employee_no}
            placeholder="自動採番OK"
          />
          <ErrorMsg errors={fieldErrors.employee_no} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold text-tiffany-700">権限・所属</h2>
        <div className="space-y-2">
          <Label htmlFor="role">権限レベル *</Label>
          <Select id="role" name="role" required defaultValue={defaults?.role ?? 'employee'}>
            {currentUserRole === 'master' && <option value="master">マスター</option>}
            {(currentUserRole === 'master' || currentUserRole === 'store') && (
              <option value="store">店舗管理者</option>
            )}
            <option value="admin">部門管理者</option>
            <option value="employee">従業員</option>
          </Select>
          <ErrorMsg errors={fieldErrors.role} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_id">会社</Label>
          <Select id="company_id" name="company_id" defaultValue={defaults?.company_id ?? ''}>
            <option value="">未選択</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <ErrorMsg errors={fieldErrors.company_id} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="store_id">店舗</Label>
          <Select id="store_id" name="store_id" defaultValue={defaults?.store_id ?? ''}>
            <option value="">未選択</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <ErrorMsg errors={fieldErrors.store_id} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department_id">部門</Label>
          <Select
            id="department_id"
            name="department_id"
            defaultValue={defaults?.department_id ?? ''}
          >
            <option value="">未選択</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <ErrorMsg errors={fieldErrors.department_id} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_title">役職・業務</Label>
          <Input
            id="job_title"
            name="job_title"
            defaultValue={defaults?.job_title}
            placeholder="店長 / ホール など"
          />
          <ErrorMsg errors={fieldErrors.job_title} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employment_type">雇用形態</Label>
          <Select
            id="employment_type"
            name="employment_type"
            defaultValue={defaults?.employment_type ?? ''}
          >
            <option value="">未選択</option>
            <option value="正社員">正社員</option>
            <option value="契約社員">契約社員</option>
            <option value="パート">パート</option>
            <option value="アルバイト">アルバイト</option>
            <option value="業務委託">業務委託</option>
          </Select>
          <ErrorMsg errors={fieldErrors.employment_type} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hire_date">入社日</Label>
          <Input id="hire_date" name="hire_date" type="date" defaultValue={defaults?.hire_date} />
          <ErrorMsg errors={fieldErrors.hire_date} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold text-tiffany-700">給与</h2>
        <div className="space-y-2">
          <Label htmlFor="wage_type">給与種別</Label>
          <Select
            id="wage_type"
            name="wage_type"
            value={wageType}
            onChange={(e) => setWageType(e.target.value as typeof wageType)}
          >
            <option value="">未選択</option>
            <option value="hourly">時給</option>
            <option value="monthly">月給</option>
            <option value="daily">日給</option>
          </Select>
          <ErrorMsg errors={fieldErrors.wage_type} />
        </div>

        {wageType === 'hourly' && (
          <div className="space-y-2">
            <Label htmlFor="hourly_wage">時給（円）*</Label>
            <Input
              id="hourly_wage"
              name="hourly_wage"
              type="number"
              min={0}
              defaultValue={defaults?.hourly_wage}
              placeholder={`例: 1100 (推奨 ${WAGE_RANGE.hourly.min.toLocaleString()}〜${WAGE_RANGE.hourly.max.toLocaleString()}円)`}
            />
            <p className="text-xs text-muted-foreground">
              推奨範囲: {WAGE_RANGE.hourly.min.toLocaleString()}〜{WAGE_RANGE.hourly.max.toLocaleString()}円
              （範囲外は保存時に確認）
            </p>
            <ErrorMsg errors={fieldErrors.hourly_wage} />
          </div>
        )}
        {wageType === 'monthly' && (
          <div className="space-y-2">
            <Label htmlFor="monthly_wage">月給（円）*</Label>
            <Input
              id="monthly_wage"
              name="monthly_wage"
              type="number"
              min={0}
              defaultValue={defaults?.monthly_wage}
              placeholder={`例: 250000 (推奨 ${WAGE_RANGE.monthly.min.toLocaleString()}〜${WAGE_RANGE.monthly.max.toLocaleString()}円)`}
            />
            <p className="text-xs text-muted-foreground">
              推奨範囲: {WAGE_RANGE.monthly.min.toLocaleString()}〜{WAGE_RANGE.monthly.max.toLocaleString()}円
              （範囲外は保存時に確認）
            </p>
            <ErrorMsg errors={fieldErrors.monthly_wage} />
          </div>
        )}
        {wageType === 'daily' && (
          <div className="space-y-2">
            <Label htmlFor="daily_wage">日給（円）*</Label>
            <Input
              id="daily_wage"
              name="daily_wage"
              type="number"
              min={0}
              defaultValue={defaults?.daily_wage}
              placeholder={`例: 12000 (推奨 ${WAGE_RANGE.daily.min.toLocaleString()}〜${WAGE_RANGE.daily.max.toLocaleString()}円)`}
            />
            <p className="text-xs text-muted-foreground">
              推奨範囲: {WAGE_RANGE.daily.min.toLocaleString()}〜{WAGE_RANGE.daily.max.toLocaleString()}円
              （範囲外は保存時に確認）
            </p>
            <ErrorMsg errors={fieldErrors.daily_wage} />
          </div>
        )}
        {wageType === '' && (
          <p className="self-end text-xs text-muted-foreground">
            給与種別を選ぶと金額入力が表示されます
          </p>
        )}
      </section>

      <section className="flex items-center gap-2">
        <input
          id="is_active"
          name="is_active"
          type="checkbox"
          defaultChecked={defaults?.is_active ?? true}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="is_active">有効（オフにすると無効化）</Label>
        <ErrorMsg errors={fieldErrors.is_active} />
      </section>

      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}
