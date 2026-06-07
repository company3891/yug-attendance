'use client'

import { useState } from 'react'

interface UserEditTabsProps {
  basicContent: React.ReactNode
  authContent: React.ReactNode
}

export function UserEditTabs({ basicContent, authContent }: UserEditTabsProps) {
  const [active, setActive] = useState<'basic' | 'auth'>('basic')

  return (
    <>
      <div className="mb-6 flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActive('basic')}
          className={[
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            active === 'basic'
              ? 'border-tiffany-500 text-tiffany-700 dark:text-tiffany-300'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          ].join(' ')}
        >
          基本情報
        </button>
        <button
          onClick={() => setActive('auth')}
          className={[
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            active === 'auth'
              ? 'border-tiffany-500 text-tiffany-700 dark:text-tiffany-300'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          ].join(' ')}
        >
          認証設定
        </button>
      </div>

      <div className={active === 'basic' ? '' : 'hidden'}>{basicContent}</div>
      <div className={active === 'auth' ? '' : 'hidden'}>{authContent}</div>
    </>
  )
}
