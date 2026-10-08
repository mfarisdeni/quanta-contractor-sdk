import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = ['/login', '/sign-up', '/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isStaticPath(pathname: string) {
  return pathname.startsWith('/_next') || /\.[a-z0-9]+$/i.test(pathname)
}

function isApiPath(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname) || isStaticPath(pathname) || isApiPath(pathname)) {
    return NextResponse.next({ request })
  }

  const client = createProxyClient(request)

  const { data } = await client.supabase.auth.getClaims()

  const response = client.response

  if (!data?.claims) {
    const url = request.nextUrl.clone()
    const next = `${pathname}${request.nextUrl.search}`
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|webmanifest)$).*)',
  ],
}
