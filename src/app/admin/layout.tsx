import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase'

/**
 * Admin レイアウト
 * 1. 未ログイン → /auth/signin にリダイレクト
 * 2. ログイン済みだが admin ロールなし → / にリダイレクト
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin?redirectTo=/admin')
  }

  // Service Role で profiles を取得（RLS バイパス）
  const serviceSupabase = createServerClient()
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/?error=forbidden')
  }

  return <>{children}</>
}
