'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function OnboardingForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()

    if (!trimmedName) {
      setError('Nama organisasi wajib diisi.')
      return
    }
    if (!trimmedSlug) {
      setError('Slug wajib diisi.')
      return
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setError('Slug hanya boleh berisi huruf kecil, angka, dan tanda minus.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('create_organization', {
      p_name: trimmedName,
      p_slug: trimmedSlug,
    })
    setLoading(false)

    if (rpcError) {
      const code = rpcError.code ?? ''
      if (code === '23505' || rpcError.message.toLowerCase().includes('slug')) {
        setError('Slug sudah dipakai workspace lain. Pilih slug lain.')
      } else if (code === '42501' || rpcError.message.includes('authentication required')) {
        setError('Sesi Anda berakhir. Masuk kembali untuk melanjutkan.')
      } else {
        setError('Gagal membuat workspace. Silakan coba lagi.')
      }
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <CardContent>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="organization-name">
            Nama organisasi
          </label>
          <input
            id="organization-name"
            type="text"
            autoComplete="organization"
            placeholder="PT Karya Bangun"
            className={inputClass}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (!slugTouched) setSlug(slugify(event.target.value))
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="organization-slug">
            Slug
          </label>
          <input
            id="organization-slug"
            type="text"
            autoComplete="off"
            placeholder="pt-karya-bangun"
            className={inputClass}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value.toLowerCase())
            }}
          />
          <p className="text-xs text-muted-foreground">
            Huruf kecil, angka, dan minus. Digunakan sebagai identitas workspace Anda.
          </p>
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
          {loading ? 'Membuat workspace…' : 'Buat workspace'}
        </Button>
      </form>
    </CardContent>
  )
}
