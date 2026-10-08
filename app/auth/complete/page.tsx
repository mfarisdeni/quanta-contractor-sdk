'use client'

import { useEffect } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export default function AuthCompletePage() {
  useEffect(() => {
    async function complete() {
      try {
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const next = safeNextPath(searchParams.get('next'))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const supabase = createClient()
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            window.history.replaceState(null, '', window.location.pathname)
            window.location.replace(next)
            return
          }
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            window.history.replaceState(null, '', window.location.pathname)
            window.location.replace(next)
            return
          }
        }
      } catch {}
      window.location.replace('/auth/error')
    }

    complete()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Quanta AI</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Project assistant</p>
          </div>
        </div>
        <Card className="border-border/70 shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Loader2 className="size-4 animate-spin" />
              Memverifikasi email
            </CardTitle>
            <CardDescription>Menyelesaikan konfirmasi akun Anda, mohon tunggu sebentar.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  )
}
