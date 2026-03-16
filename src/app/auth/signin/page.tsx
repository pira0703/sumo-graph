'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

function SignInContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/admin'
  const error = searchParams.get('error')

  async function handleGoogleSignIn() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--washi)" }}>
      <div className="rounded-xl p-8 w-full max-w-sm shadow-sm" style={{ backgroundColor: "var(--white)", border: "1px solid var(--border)" }}>
        <div className="text-center mb-8">
          {/* えにし 円相ロゴ */}
          <div className="flex justify-center mb-3">
            <svg width="52" height="52" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M48,12 C68,10 82,24 84,44 C86,64 74,80 55,85 C36,90 18,80 12,62 C6,44 14,24 28,16 C36,11 44,12 48,12"
                fill="none" stroke="#5B3A8A" strokeWidth="5" strokeLinecap="round"/>
              <circle cx="36" cy="52" r="5" fill="#5B3A8A" opacity=".7"/>
              <circle cx="60" cy="52" r="5" fill="#5B3A8A" opacity=".7"/>
              <line x1="41" y1="52" x2="55" y2="52" stroke="#C8982A" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--purple)", fontFamily: "'Noto Serif JP', serif" }}>えにし</h1>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>ログインして続ける</p>
        </div>

        {error && (
          <div className="text-sm rounded-lg p-3 mb-4" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", color: "#dc2626" }}>
            認証エラーが発生しました。もう一度お試しください。
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google でログイン
        </button>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
