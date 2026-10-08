import { Bot } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingForm } from '@/components/onboarding-form'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/login')

  const { data: organizations, error } = await supabase.from('organizations').select('id')
  if (!error && organizations && organizations.length > 0) redirect('/')

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4 text-foreground">
      <div className="w-full max-w-md">
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
            <CardTitle className="text-lg">Buat workspace Anda</CardTitle>
            <CardDescription>
              Workspace adalah tempat organisasi, anggota, dan proyek Anda dikelola.
            </CardDescription>
          </CardHeader>
          <OnboardingForm />
        </Card>
      </div>
    </div>
  )
}
