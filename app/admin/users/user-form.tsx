'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

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
  is_active?: boolean
  company_id?: string
  store_id?: string
  department_id?: string
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
  action: (formData: FormData) => Promise<{ error: string } | void>
  defaults?: UserFormDefaults
  mode: 'create' | 'edit'
  companies: { id: string; name: string }[]
  stores: { id: string; name: string; company_id: string }[]
  departments: { id: string; name: string; store_id: string }[]
  currentUserRole: 'master' | 'store' | 'admin' | 'employee'
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await action(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold text-tiffany-700">基本情報</h2>
        <div className="space-y-2">
          <Label htmlFor="email">メールアドレス（ログインID） *</Label>
          <Input id="email" name="email" type="email" required defaultValue={defaults?.email} disabled={mode === 'edit'} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード {mode === 'create' ? '*' : '（変更時のみ入力）'}</Label>
          <Input id="password" name="password" type="password" minLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">氏名 *</Label>
          <Input id="name" name="name" required defaultValue={defaults?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_kana">氏名カナ</Label>
          <Input id="name_kana" name="name_kana" defaultValue={defaults?.name_kana} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee_no">従業員ナンバー</Label>
          <Input id="employee_no" name="employee_no" defaultValue={defaults?.employee_no} placeholder="自動採番OK" />
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="department_id">部門</Label>
          <Select id="department_id" name="department_id" defaultValue={defaults?.department_id ?? ''}>
            <option value="">未選択</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_title">役職・業務</Label>
          <Input id="job_title" name="job_title" defaultValue={defaults?.job_title} placeholder="店長 / ホール など" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employment_type">雇用形態</Label>
          <Select id="employment_type" name="employment_type" defaultValue={defaults?.employment_type ?? ''}>
            <option value="">未選択</option>
            <option value="正社員">正社員</option>
            <option value="契約社員">契約社員</option>
            <option value="パート">パート</option>
            <option value="アルバイト">アルバイト</option>
            <option value="業務委託">業務委託</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hire_date">入社日</Label>
          <Input id="hire_date" name="hire_date" type="date" defaultValue={defaults?.hire_date} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-semibold text-tiffany-700">給与（簡易）</h2>
        <div className="space-y-2">
          <Label htmlFor="wage_type">給与種別</Label>
          <Select id="wage_type" name="wage_type" defaultValue={defaults?.wage_type ?? ''}>
            <option value="">未選択</option>
            <option value="hourly">時給</option>
            <option value="monthly">月給</option>
            <option value="daily">日給</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hourly_wage">時給（円）</Label>
          <Input id="hourly_wage" name="hourly_wage" type="number" min={0} defaultValue={defaults?.hourly_wage} />
        </div>
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
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
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
