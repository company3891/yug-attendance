import { createBrowserClient } from '@supabase/ssr'

// NOTE: Phase 1 は untyped。Phase 2 で `npm run db:types` 後に Database 型を再導入する。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
