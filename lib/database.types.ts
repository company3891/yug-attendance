/**
 * Supabase 自動生成型のラッパー。
 *
 * - `lib/database.types.generated.ts` が `npm run db:types` で生成される本体
 * - 本ファイルはアプリ側で使いやすい型エイリアスを再エクスポート
 *
 * 再生成手順:
 *   npm run db:types
 *   （生成後、先頭に CLI 警告行が混ざることがあるので確認）
 */

export type { Database, Json } from './database.types.generated'
import type { Database } from './database.types.generated'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// ---------------------------------------------------------------------------
// アプリ内でよく使う型のエイリアス
// ---------------------------------------------------------------------------
export type UserRole = Enums<'user_role'>
export type EmploymentType =
  | '正社員'
  | '契約社員'
  | 'パート'
  | 'アルバイト'
  | '業務委託'

export type AppUser = Tables<'users'>
export type Company = Tables<'companies'>
export type Store = Tables<'stores'>
export type Department = Tables<'departments'>
