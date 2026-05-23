'use client'

import { useEffect, useState } from 'react'

/**
 * メールアドレスを HTML に平文で書かないための JS 分割生成コンポーネント。
 * 仕様書 Section 9（セキュリティ要件）準拠。
 *
 * 使い方:
 *   <MailLink user="info" domain="yug.co.jp" />
 *   <MailLink user="info" domain="yug.co.jp" label="お問い合わせ" />
 */
export function MailLink({
  user,
  domain,
  label,
  className,
}: {
  user: string
  domain: string
  label?: string
  className?: string
}) {
  const [revealed, setRevealed] = useState('')

  useEffect(() => {
    // クライアントマウント後にのみ結合してDOMに反映する
    setRevealed(`${user}@${domain}`)
  }, [user, domain])

  if (!revealed) {
    return (
      <span className={className} aria-label="メールアドレス読み込み中">
        {label ?? '（メールアドレス）'}
      </span>
    )
  }

  return (
    <a href={`mailto:${revealed}`} className={className}>
      {label ?? revealed}
    </a>
  )
}
