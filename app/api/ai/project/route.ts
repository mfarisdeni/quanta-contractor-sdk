import { stepCountIs, streamText } from 'ai'
import { createAiModel, isAiConfigured, QUANTA_AI_MODEL_ID } from '@/lib/ai/provider'
import { createQuantaTools } from '@/lib/ai/tools'
import { queryProject } from '@/lib/ai/tools/get-project'
import { UUID_PATTERN } from '@/lib/ai/tools/shared'
import { createClient } from '@/lib/supabase/server'

const MAX_QUESTION_LENGTH = 2000
const MAX_PROJECT_ID_LENGTH = 64
const MAX_TOOL_STEPS = 8

const SYSTEM_INSTRUCTION = `You are Quanta AI, an assistant for construction project monitoring.

You have read-only tools for retrieving project information.

Use tools when the user's question requires project data.

Never invent project facts.

Treat tool results as the source of truth.

Distinguish facts from inference.

If data is missing, say so.

Never claim that a project fact exists without retrieving it.

You may summarize and reason over retrieved data, but you must not modify project data.`

function fail(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function logResult(projectId: string, ok: boolean, ms?: number) {
  console.info(
    '[ai] project question',
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

  const result = streamText({
    model: createAiModel(),
    system: SYSTEM_INSTRUCTION,
    messages: [{ role: 'user', content: question }],
    tools: createQuantaTools({ supabase, projectId }),
    stopWhen: stepCountIs(MAX_TOOL_STEPS),
    onFinish: () => logResult(projectId, true, Date.now() - startedAt),
    onError: () => logResult(projectId, false, Date.now() - startedAt),
  })

  return result.toUIMessageStreamResponse({
    onError: () => 'Maaf, layanan AI sedang bermasalah. Silakan coba lagi nanti.',
  })
}