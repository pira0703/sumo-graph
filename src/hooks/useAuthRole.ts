'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export type Role = 'admin' | 'editor' | 'paid' | 'user' | null // null = 未ログイン

/** ロールの強さ順（低→高） */
const ROLE_LEVELS: Record<string, number> = {
  user: 1, paid: 2, editor: 3, admin: 4,
}

/** 指定ロール以上の権限があるか */
export function hasRole(role: Role, required: 'paid' | 'editor' | 'admin'): boolean {
  if (!role) return false
  return (ROLE_LEVELS[role] ?? 0) >= (ROLE_LEVELS[required] ?? 99)
}

type AuthRoleState = {
  role: Role
  userId: string | null
  avatar: string | null
  loading: boolean
}

export function useAuthRole(): AuthRoleState {
  const [state, setState] = useState<AuthRoleState>({
    role: null,
    userId: null,
    avatar: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState({ role: null, userId: null, avatar: null, loading: false })
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setState({
        role: (profile?.role as Role) ?? 'user',
        userId: user.id,
        avatar: user.user_metadata?.avatar_url ?? null,
        loading: false,
      })
    }
    fetchRole()
  }, [])

  return state
}
