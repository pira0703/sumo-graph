'use client'

import { useEffect, useState } from 'react'

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

/**
 * ログイン中ユーザーのロールを取得するフック
 * /api/me 経由でサーバーサイドから取得（RLS バイパス、サービスロール使用）
 */
export function useAuthRole(): AuthRoleState {
  const [state, setState] = useState<AuthRoleState>({
    role: null,
    userId: null,
    avatar: null,
    loading: true,
  })

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: { role: Role; userId: string | null; avatar: string | null }) => {
        setState({
          role: data.role,
          userId: data.userId,
          avatar: data.avatar,
          loading: false,
        })
      })
      .catch(() => {
        setState({ role: null, userId: null, avatar: null, loading: false })
      })
  }, [])

  return state
}
