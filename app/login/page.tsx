'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function safeNextTarget() {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Email atau kata sandi salah.'
          : 'Gagal masuk. Periksa data Anda lalu coba lagi.'
      )
      return
    }

    router.push(safeNextTarget())
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Quanta AI</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Project assistant
            </p>
          </div>
        </div>
        <Card className="border-border/70 shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Masuk</CardTitle>
            <CardDescription>Masuk ke workspace Quanta Contractor Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  className={inputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="password">
                  Kata sandi
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  className={inputClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Memproses…' : 'Masuk'}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Belum punya akun?{' '}
              <Link
                href="/sign-up"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Daftar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
