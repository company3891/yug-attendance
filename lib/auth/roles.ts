import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AppUser, UserRole } from '@/lib/database.types'

const ROLE_RANK: Record<UserRole, number> = {
  master: 4,
  store: 3,
  admin: 2,
  employee: 1,
}

export function roleSatisfies(actual: UserRole, required: UserRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required]
}

/**
 * 現在ログイン中のユーザー情報を取得。未ログインなら null。
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data, error } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (error || !data) return null
  return data as AppUser
}

/**
 * 指定ロール以上を必要とする Server Component の冒頭で呼ぶ。
 * 不適格なら /login or /dashboard にリダイレクト。
 */
export async function requireRole(required: UserRole): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!roleSatisfies(user.role, required)) redirect('/dashboard')
  return user
}
