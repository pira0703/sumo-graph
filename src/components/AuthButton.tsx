'use client'

import Link from 'next/link'
import { useAuthRole } from '@/hooks/useAuthRole'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

export default function AuthButton() {
  const { role, avatar, loading } = useAuthRole()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  if (loading) return <div className="w-5 h-5 rounded-full animate-pulse" style={{ backgroundColor: "var(--purple-pale)" }} />

  if (!role) {
    return (
      <Link
        href="/auth/signin"
        className="text-xs px-2 py-1 rounded transition-colors"
        style={{ backgroundColor: "var(--purple-pale)", border: "1px solid var(--purple)", color: "var(--purple)" }}
      >
        ログイン
      </Link>
    )
  }

  const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
    admin:  { bg: 'rgba(91,58,138,0.15)', color: 'var(--purple)' },
    editor: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    paid:   { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
    user:   { bg: 'rgba(107,91,78,0.1)',   color: 'var(--ink-muted)' },
  }

  const badge = ROLE_BADGE[role] ?? { bg: 'transparent', color: 'var(--ink-muted)' }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs px-1.5 py-0.5 rounded"
        style={{ backgroundColor: badge.bg, color: badge.color }}
      >
        {role}
      </span>
      {avatar && <img src={avatar} alt="" className="w-5 h-5 rounded-full" />}
      <button
        onClick={handleSignOut}
        className="text-xs transition-colors"
        style={{ color: "var(--border-dark)" }}
        title="サインアウト"
      >
        ×
      </button>
    </div>
  )
}
