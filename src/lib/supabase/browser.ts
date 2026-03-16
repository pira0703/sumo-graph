import { createBrowserClient } from '@supabase/ssr'

/**
 * クライアントコンポーネント用ブラウザクライアント
 * OAuth サインイン・サインアウトに使う
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
