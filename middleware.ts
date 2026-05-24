import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api/health']

const MASTER_ONLY = ['/master']
const ADMIN_OR_ABOVE = ['/admin']
const AUTH_REQUIRED = ['/dashboard', '/me', '/clock', '/admin', '/master']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const { response, user, supabase } = await updateSession(request)

  const needsAuth = AUTH_REQUIRED.some((p) => pathname.startsWith(p)) || pathname === '/'
  if (!needsAuth) return response

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ロール取得（middleware からの軽量クエリ）
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = (profile as { role?: string } | null)?.role as
    | 'master'
    | 'store'
    | 'admin'
    | 'employee'
    | undefined

  if (MASTER_ONLY.some((p) => pathname.startsWith(p)) && role !== 'master') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (ADMIN_OR_ABOVE.some((p) => pathname.startsWith(p))) {
    if (!role || !['master', 'store', 'admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
