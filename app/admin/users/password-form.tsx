'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserActionState } from '@/lib/schemas/user'

export function PasswordForm({
  action,
}: {
  action: (formData: FormData) => Promise<UserActionState>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setOk(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await action(formData)
      if (!result) return
      if ('ok' in result && result.ok) {
        setOk(result.message ?? '更新しました')
        form.reset()
      } else if ('ok' in result && !result.ok) {
        if (result.formError) setError(result.formError)
        if (result.fieldErrors?.password?.length) setError(result.fieldErrors.password.join(' / '))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold text-tiffany-700">パスワードを変更</h2>
      <p className="text-xs text-muted-foreground">
        管理者操作。8文字以上で新しいパスワードを設定します。本人にはこの後別途連絡してください。
      </p>
      <div className="space-y-2">
        <Label htmlFor="new_password">新しいパスワード</Label>
        <Input
          id="new_password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="text-xs text-tiffany-700">
          ✅ {ok}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? '変更中…' : 'パスワードを更新'}
      </Button>
    </form>
  )
}
