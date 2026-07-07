'use client'

import { Button } from '@/components/ui/button'

/** ブラウザの印刷ダイアログを開く（出勤簿プレビューの印刷）。QR管理画面と同パターン。 */
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
