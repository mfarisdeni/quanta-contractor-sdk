import Link from 'next/link'
import { Bot } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthErrorPage() {
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
            <CardTitle className="text-lg">Konfirmasi gagal</CardTitle>
            <CardDescription>
              Link konfirmasi tidak valid, sudah kedaluwarsa, atau dibuka di peramban lain.
              Buka link dari peramban yang sama tempat Anda mendaftar, atau daftar ulang untuk
              mendapatkan link baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
              Kembali ke halaman masuk
            </Link>
            <Link
              href="/sign-up"
              className={buttonVariants({ variant: 'ghost', className: 'w-full' })}
            >
              Daftar ulang
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
