'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type UserRow = {
  id: string
  email: string
  name: string
  avatar: string | null
  role: 'admin' | 'editor' | 'paid' | 'user'
  created_at: string
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:  { label: 'Admin',  color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  editor: { label: 'Editor', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  paid:   { label: 'Paid',   color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  user:   { label: 'User',   color: 'bg-stone-500/20 text-stone-300 border-stone-500/40' },
}

export default function UsersManager({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // 自分の ID を取得（自分の行をロックするため）
  useState(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  })

  async function handleRoleChange(userId: string, newRole: string) {
    setLoading(userId)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '更新に失敗しました')
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as UserRow['role'] } : u))
      )
      setMessage({ type: 'success', text: 'ロールを更新しました' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '更新に失敗しました' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
          message.type === 'success'
            ? 'bg-green-900/30 border-green-700 text-green-300'
            : 'bg-red-900/30 border-red-700 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-700 text-stone-400 text-left">
              <th className="px-4 py-3">ユーザー</th>
              <th className="px-4 py-3">現在のロール</th>
              <th className="px-4 py-3">ロール変更</th>
              <th className="px-4 py-3">登録日</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleInfo = ROLE_LABELS[user.role]
              const isSelf = user.id === currentUserId
              return (
                <tr key={user.id} className="border-b border-stone-800 hover:bg-stone-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {user.avatar && (
                        <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-stone-100 font-medium">{user.name}</span>
                          {isSelf && (
                            <span className="text-xs bg-stone-700 text-stone-400 px-1.5 py-0.5 rounded">自分</span>
                          )}
                        </div>
                        <div className="text-stone-500 text-xs">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-xs text-stone-600 italic">変更不可（自分）</span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={loading === user.id}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="bg-stone-800 border border-stone-600 text-stone-200 text-xs rounded px-2 py-1 disabled:opacity-50"
                      >
                        <option value="user">user</option>
                        <option value="paid">paid</option>
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {new Date(user.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                  ユーザーがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-600 mt-3">
        ※ 自分自身のロールは変更できません（ロックアウト防止）
      </p>
    </div>
  )
}
