'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Bot, Loader2, MailCheck } from 'lucide-react'
import { buttonVariants, Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Email wajib diisi.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Format email tidak valid.')
      return
    }
    if (!password) {
      setError('Kata sandi wajib diisi.')
      return
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    if (password !== confirmation) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    setLoading(false)

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes('already registered')
          ? 'Email sudah terdaftar. Coba masuk atau gunakan link konfirmasi yang sudah dikirim.'
          : 'Gagal membuat akun. Periksa data Anda lalu coba lagi.'
      )
      return
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('Email sudah terdaftar. Coba masuk atau gunakan link konfirmasi yang sudah dikirim.')
      return
    }

    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    setEmailSent(true)
  }

  if (emailSent) {
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
            <CardHeader className="space-y-3">
              <MailCheck className="size-8 text-emerald-600" />
              <CardTitle className="text-lg">Periksa email Anda</CardTitle>
              <CardDescription>
                Kami sudah mengirim link konfirmasi ke{' '}
                <span className="font-medium text-foreground">{email}</span>. Buka link tersebut
                untuk mengaktifkan akun, lalu masuk.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
                Buka halaman masuk
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEmailSent(false)
                  setError(null)
                  setConfirmation('')
                }}
                className={buttonVariants({ variant: 'ghost', className: 'w-full' })}
              >
                Daftar dengan email lain
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
            <CardTitle className="text-lg">Buat akun</CardTitle>
            <CardDescription>Daftar untuk membuat workspace Quanta Contractor.</CardDescription>
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
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  className={inputClass}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="confirmation">
                  Ulangi kata sandi
                </label>
                <input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Masukkan ulang kata sandi"
                  className={inputClass}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
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
                {loading ? 'Memproses…' : 'Buat akun'}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Sudah punya akun?{' '}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Masuk
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
