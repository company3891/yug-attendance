'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { reissueQrAction, revokeQrAction } from './actions'

export function PrintButton() {
  return (
    <Button
      onClick={() => {
        if (typeof window !== 'undefined') window.print()
      }}
    >
      印刷
    </Button>
  )
}

export function QrActionsClient({
  userId,
  isRevoked,
  isUnissued,
}: {
  userId: string
  isRevoked: boolean
  isUnissued: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function onReissue() {
    if (!confirm('QRを再発行します。旧QRは即時失効しますがよろしいですか？')) return
    startTransition(async () => {
      const r = await reissueQrAction(userId)
      setMsg(r && 'ok' in r && r.ok ? 'QRを再発行しました' : (r && 'formError' in r ? r.formError ?? 'エラー' : 'エラー'))
    })
  }

  function onRevoke() {
    const reason = prompt('失効の理由を入力してください（任意）') ?? null
    if (!confirm('QRを失効させます（再発行されません）。よろしいですか？')) return
    startTransition(async () => {
      const r = await revokeQrAction(userId, reason)
      setMsg(r && 'ok' in r && r.ok ? 'QRを失効させました' : (r && 'formError' in r ? r.formError ?? 'エラー' : 'エラー'))
    })
  }

  return (
    <div className="flex flex-wrap gap-1 print:hidden">
      <Button size="sm" variant="outline" onClick={onReissue} disabled={isPending} className="flex-1">
        {isUnissued ? '発行' : '再発行'}
      </Button>
      {!isRevoked && !isUnissued && (
        <Button size="sm" variant="ghost" onClick={onRevoke} disabled={isPending} className="flex-1">
          失効
        </Button>
      )}
      {msg && <p className="w-full text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
