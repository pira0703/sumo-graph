import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase'

const VALID_ROLES = ['admin', 'editor', 'paid', 'user'] as const
type Role = typeof VALID_ROLES[number]

/**
 * PATCH /api/admin/users/[id]
 * ロール変更（admin のみ実行可能）
 * ⚠️ 自分自身のロールは変更不可（admin ロックアウト防止）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 呼び出し元が admin かチェック
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 自分自身のロールは変更不可（誤操作でロックアウト防止）
  if (user.id === id) {
    return NextResponse.json(
      { error: '自分自身のロールは変更できません' },
      { status: 403 }
    )
  }

  const serviceSupabase = createServerClient()
  const { data: callerProfile } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ロール値のバリデーション
  const { role } = await request.json()
  if (!VALID_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  const { error } = await serviceSupabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, role })
}
