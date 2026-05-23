'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 軽量なネイティブ select ラッパー（shadcn-ui の Radix 版は Phase 後半で導入予定）。
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'
