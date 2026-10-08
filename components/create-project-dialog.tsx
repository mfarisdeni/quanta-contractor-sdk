'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

type CreateProjectDialogProps = {
  open: boolean
  organizationId: string
  onClose: () => void
  onCreated: (name: string) => void
}

function friendlyError(error: { code?: string | null; message?: string | null } | null) {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  if (code === '42501') return 'Anda tidak memiliki akses untuk membuat proyek di workspace ini.'
  if (message.includes('projects_name_not_empty')) return 'Nama proyek wajib diisi.'
  if (message.includes('projects_budget_check')) return 'Anggaran harus berupa angka nol atau lebih.'
  if (message.includes('projects_dates_check')) return 'Tanggal selesai harus setelah atau sama dengan tanggal mulai.'
  if (code === '23505') return 'Proyek dengan data yang sama sudah ada di workspace ini.'
  if (code === 'PGRST301' || message.toLowerCase().includes('jwt')) return 'Sesi Anda berakhir. Masuk kembali untuk melanjutkan.'
  return 'Gagal membuat proyek. Silakan coba lagi.'
}

export function CreateProjectDialog({ open, organizationId, onClose, onCreated }: CreateProjectDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [description, setDescription] = useState('')
  const [clientName, setClientName] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setProjectCode('')
    setDescription('')
    setClientName('')
    setContractorName('')
    setLocation('')
    setStartDate('')
    setEndDate('')
    setBudget('')
    setError(null)
    setLoading(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, loading, onClose])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Nama proyek wajib diisi.')
      return
    }
    if (!organizationId) {
      setError('Workspace tidak ditemukan. Muat ulang halaman untuk mencoba lagi.')
      return
    }

    const trimmedBudget = budget.trim()
    const numericBudget = trimmedBudget === '' ? null : Number(trimmedBudget)
    if (trimmedBudget !== '' && (numericBudget === null || !Number.isFinite(numericBudget) || numericBudget < 0)) {
      setError('Anggaran harus berupa angka nol atau lebih.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('Tanggal selesai harus setelah atau sama dengan tanggal mulai.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: claims } = await supabase.auth.getClaims()
    const userId = claims?.claims?.sub
    if (!userId) {
      setLoading(false)
      setError('Sesi Anda berakhir. Masuk kembali untuk melanjutkan.')
      return
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        name: trimmedName,
        project_code: projectCode.trim() || null,
        description: description.trim() || null,
        client_name: clientName.trim() || null,
        contractor_name: contractorName.trim() || null,
        location: location.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        budget: numericBudget,
      })
      .select('id')
      .single()

    if (projectError || !project) {
      setLoading(false)
      setError(friendlyError(projectError))
      return
    }

    const { error: ownerError } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, user_id: userId, role: 'owner' })

    if (ownerError && ownerError.code !== '23505') {
      setLoading(false)
      setError('Proyek dibuat, tetapi penetapan peran pemilik gagal. Muat ulang halaman untuk memeriksa proyek Anda.')
      router.refresh()
      return
    }

    setLoading(false)
    onCreated(trimmedName)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => { if (!loading) onClose() }} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="create-project-title" className="text-base font-semibold tracking-tight">
              Buat proyek baru
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Proyek ditambahkan ke workspace Anda dan Anda menjadi pemiliknya.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={loading} aria-label="Tutup">
            <X />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="project-name">
              Nama proyek
            </label>
            <input
              id="project-name"
              type="text"
              autoFocus
              placeholder="Gedung Kantor Pusat"
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="project-code">
                Kode proyek
              </label>
              <input
                id="project-code"
                type="text"
                autoComplete="off"
                placeholder="PRJ-001"
                className={inputClass}
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="project-client">
                Klien
              </label>
              <input
                id="project-client"
                type="text"
                autoComplete="off"
                placeholder="PT Sentosa"
                className={inputClass}
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="project-contractor">
                Kontraktor
              </label>
              <input
                id="project-contractor"
                type="text"
                autoComplete="off"
                placeholder="PT Karya Bangun"
                className={inputClass}
                value={contractorName}
                onChange={(event) => setContractorName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="project-location">
                Lokasi
              </label>
              <input
                id="project-location"
                type="text"
                autoComplete="off"
                placeholder="Jakarta Selatan"
                className={inputClass}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="project-start">
                Tanggal mulai
              </label>
              <input
                id="project-start"
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="project-end">
                Tanggal selesai
              </label>
              <input
                id="project-end"
                type="date"
                className={inputClass}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="project-budget">
                Anggaran (Rp)
              </label>
              <input
                id="project-budget"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="0"
                className={inputClass}
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="project-description">
                Deskripsi
              </label>
              <textarea
                id="project-description"
                rows={3}
                placeholder="Ringkasan ruang lingkup pekerjaan"
                className={cn(inputClass, 'h-auto min-h-[80px] resize-y py-2')}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Membuat proyek…' : 'Buat proyek'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
