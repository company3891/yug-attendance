'use client'

import { useState } from 'react'

interface UserEditTabsProps {
  basicContent: React.ReactNode
  authContent: React.ReactNode
  wageContent?: React.ReactNode
}

type TabKey = 'basic' | 'auth' | 'wage'

export function UserEditTabs({ basicContent, authContent, wageContent }: UserEditTabsProps) {
  const [active, setActive] = useState<TabKey>('basic')

  const tabBtn = (key: TabKey, label: string) => (
    <button
      onClick={() => setActive(key)}
      className={[
        'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active === key
          ? 'border-tiffany-500 text-tiffany-700 dark:text-tiffany-300'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="mb-6 flex border-b border-gray-200 dark:border-gray-800">
        {tabBtn('basic', '基本情報')}
        {tabBtn('auth', '認証設定')}
        {wageContent && tabBtn('wage', '給与・勤怠設定')}
      </div>

      <div className={active === 'basic' ? '' : 'hidden'}>{basicContent}</div>
      <div className={active === 'auth' ? '' : 'hidden'}>{authContent}</div>
      {wageContent && <div className={active === 'wage' ? '' : 'hidden'}>{wageContent}</div>}
    </>
  )
}
