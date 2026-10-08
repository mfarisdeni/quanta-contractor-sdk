import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = safeNextPath(searchParams.get('next'))
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  if (accessToken && refreshToken) {
    const supabase = await createClient()
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  if (!code && !tokenHash && !accessToken) {
    return NextResponse.redirect(`${origin}/auth/complete?next=${encodeURIComponent(next)}`)
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
