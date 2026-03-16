import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase'

/**
 * GET /api/me
 * ログイン中ユーザーのロールを返す（サービスロールで RLS バイパス）
 */
export async function GET() {
  // セッションからユーザーを取得（cookie ベース）
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ role: null, userId: null, avatar: null })
  }

  // Service Role で profiles を取得（RLS バイパス）
  const serviceSupabase = createServerClient()
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    role: profile?.role ?? 'user',
    userId: user.id,
    avatar: user.user_metadata?.avatar_url ?? null,
  })
}
