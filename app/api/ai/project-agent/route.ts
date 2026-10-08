import { createQuantaProjectAgent } from '@/lib/ai/agent'
import { isAiConfigured, QUANTA_AI_MODEL_ID } from '@/lib/ai/provider'
import { queryProject } from '@/lib/ai/tools/get-project'
import { UUID_PATTERN } from '@/lib/ai/tools/shared'
import { createClient } from '@/lib/supabase/server'

const MAX_QUESTION_LENGTH = 2000
const MAX_PROJECT_ID_LENGTH = 64

function fail(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function logResult(projectId: string, ok: boolean, ms?: number) {
  console.info(
    '[quanta-agent] run',
    ms === undefined
      ? { projectId, model: QUANTA_AI_MODEL_ID, ok }
      : { projectId, model: QUANTA_AI_MODEL_ID, ok, ms }
  )
}

export async function POST(request: Request) {
  const startedAt = Date.now()

  const supabase = await createClient()
  const { data: session, error: authError } = await supabase.auth.getClaims()
  if (authError || !session?.claims?.sub) {
    return fail('Sesi Anda berakhir. Masuk kembali untuk melanjutkan.', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Permintaan tidak valid.', 400)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail('Permintaan tidak valid.', 400)
  }

  const payload = body as Record<string, unknown>
  const projectId = typeof payload.projectId === 'string' ? payload.projectId.trim() : ''
  const question = typeof payload.question === 'string' ? payload.question.trim() : ''

  if (!projectId || projectId.length > MAX_PROJECT_ID_LENGTH) {
    return fail('Proyek tidak ditentukan.', 400)
  }
  if (!question) {
    return fail('Pertanyaan wajib diisi.', 400)
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return fail('Pertanyaan terlalu panjang. Maksimal 2000 karakter.', 400)
  }
  if (!UUID_PATTERN.test(projectId)) {
    return fail('Proyek tidak ditemukan atau Anda tidak memiliki akses.', 404)
  }

  const access = await queryProject(supabase, projectId)
  if (!access.ok) {
    logResult(projectId, false)
    if (access.error === 'QUERY_FAILED') {
      return fail('Gagal memuat data proyek. Silakan coba lagi nanti.', 500)
    }
    return fail('Proyek tidak ditemukan atau Anda tidak memiliki akses.', 404)
  }

  if (!isAiConfigured()) {
    logResult(projectId, false)
    return fail('Layanan AI belum dikonfigurasi di server.', 503)
  }

  const agent = createQuantaProjectAgent({ supabase, projectId })

  try {
    const result = await agent.stream({
      prompt: question,
      onEnd: () => logResult(projectId, true, Date.now() - startedAt),
    })

    return result.toUIMessageStreamResponse({
      onError: () => 'Maaf, layanan AI sedang bermasalah. Silakan coba lagi nanti.',
    })
  } catch (error) {
    logResult(projectId, false, Date.now() - startedAt)
    return fail('Maaf, layanan AI sedang bermasalah. Silakan coba lagi nanti.', 500)
  }
}