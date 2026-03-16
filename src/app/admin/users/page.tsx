import AdminNav from '@/components/AdminNav'
import UsersManager from '@/components/UsersManager'
import { createServerClient } from '@/lib/supabase'

export default async function AdminUsersPage() {
  const supabase = createServerClient()

  // profiles テーブルから全ユーザー取得（Service Role でRLSバイパス）
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, role, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('profiles fetch error:', error)
  }

  // auth.users からメール情報を取得
  const { data: authData } = await supabase.auth.admin.listUsers()
  const authUsers = authData?.users ?? []

  // profiles と auth.users をマージ
  const users = (profiles ?? []).map((profile) => {
    const authUser = authUsers.find((u) => u.id === profile.id)
    return {
      id: profile.id,
      email: authUser?.email ?? '不明',
      name: authUser?.user_metadata?.full_name ?? authUser?.email ?? '不明',
      avatar: authUser?.user_metadata?.avatar_url ?? null,
      role: profile.role as 'admin' | 'paid' | 'user',
      created_at: profile.created_at,
    }
  })

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-amber-400 mb-6">👥 ユーザー管理</h1>
        <UsersManager users={users} />
      </main>
    </div>
  )
}
