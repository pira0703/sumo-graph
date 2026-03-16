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

  if (loading) return <div className="w-5 h-5 rounded-full bg-stone-700 animate-pulse" />

  if (!role) {
    return (
      <Link
        href="/auth/signin"
        className="text-xs px-2 py-1 rounded bg-stone-800 border border-stone-700
          text-stone-400 hover:text-amber-400 hover:border-amber-600 transition-colors"
      >
        ログイン
      </Link>
    )
  }

  const ROLE_BADGE: Record<string, string> = {
    admin:  'bg-amber-500/20 text-amber-300',
    editor: 'bg-blue-500/20 text-blue-300',
    paid:   'bg-green-500/20 text-green-300',
    user:   'bg-stone-500/20 text-stone-400',
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_BADGE[role] ?? ''}`}>
        {role}
      </span>
      {avatar && <img src={avatar} alt="" className="w-5 h-5 rounded-full" />}
      <button
        onClick={handleSignOut}
        className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
        title="サインアウト"
      >
        ×
      </button>
    </div>
  )
}
