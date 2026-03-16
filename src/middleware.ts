import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Basic認証ミドルウェア
 * 本番環境の /admin 以下を BASIC_AUTH_USER / BASIC_AUTH_PASSWORD で保護する。
 * Supabase Auth 実装後はここを置き換える予定。
 */
export function middleware(request: NextRequest) {
  // ローカル開発環境はスルー
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  const basicAuth = request.headers.get('authorization')

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1]
    const decoded = Buffer.from(authValue, 'base64').toString('utf-8')
    const [user, ...passParts] = decoded.split(':')
    const password = passParts.join(':') // パスワードに : が含まれる場合も安全に扱う

    const validUser = process.env.BASIC_AUTH_USER
    const validPassword = process.env.BASIC_AUTH_PASSWORD

    if (user === validUser && password === validPassword) {
      return NextResponse.next()
    }
  }

  // 認証失敗 → ブラウザに認証ダイアログを要求
  return new NextResponse('管理者認証が必要です', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Sumo Graph Admin"',
    },
  })
}

export const config = {
  // /admin および /admin/* にのみ適用
  matcher: ['/admin', '/admin/:path*'],
}
