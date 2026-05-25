'use client'

import { QRCodeSVG } from 'qrcode.react'

export interface QrDisplayProps {
  /** QR トークン文字列 (yug:v1:store:user:version:issued:sig) */
  token: string
  /** 表示サイズ (px) */
  size?: number
  /** 印刷用に枠線を強調するか */
  printable?: boolean
  /** 補助テキスト（氏名・No 等） */
  label?: string
  subLabel?: string
}

/**
 * QR コード表示コンポーネント。
 * クライアント側でレンダリングする SVG QR。印刷時に拡大しても鮮明。
 */
export function QrDisplay({ token, size = 192, printable = false, label, subLabel }: QrDisplayProps) {
  return (
    <div
      className={
        printable
          ? 'flex flex-col items-center gap-2 rounded-xl border-2 border-tiffany-500 bg-white p-4 print:break-inside-avoid'
          : 'flex flex-col items-center gap-2 rounded-xl border border-tiffany-100 bg-white p-3'
      }
    >
      <QRCodeSVG
        value={token}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#022E2B"
      />
      {label && <div className="text-sm font-semibold text-foreground">{label}</div>}
      {subLabel && <div className="font-mono text-xs text-muted-foreground">{subLabel}</div>}
    </div>
  )
}
