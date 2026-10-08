import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'

type Check = {
  name: string
  pass: boolean | null
  detail: string
}

const AI_ROUTE = '/api/ai/project'
const MAX_QUESTION_LENGTH = 2000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FORBIDDEN_PATTERN = /SUPABASE_SECRET_KEY|SERVICE_ROLE|service_role|sb_secret_|gsk_[A-Za-z0-9]{10,}/

const AI_SOURCE_FILES = ['app/api/ai/project/route.ts', 'lib/ai/provider.ts', 'lib/supabase/server.ts']

function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) collectSources(path, out)
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(path)
  }
  return out
}

function cookieHeader(request: NextRequest) {
  return request.cookies
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
}

async function postAi(origin: string, body: unknown, headers: Record<string, string>) {
  const response = await fetch(`${origin}${AI_ROUTE}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  await response.text().catch(() => '')
  return response.status
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const checks: Check[] = []
  const push = (name: string, pass: boolean | null, detail: string) => checks.push({ name, pass, detail })
  const respond = (authenticated: boolean) =>
    NextResponse.json(
      { dev: true, authenticated, probe: request.nextUrl.searchParams.get('probe'), checks, ok: authenticated && checks.every((check) => check.pass !== false) },
      { headers: { 'Cache-Control': 'no-store' } }
    )

  const origin = request.nextUrl.origin
  const authed = { cookie: cookieHeader(request) }

  const sources = [
    ...AI_SOURCE_FILES.map((path) => join(process.cwd(), path)),
    ...collectSources(join(process.cwd(), 'lib', 'ai')),
  ].filter((path, index, all) => all.indexOf(path) === index)
  const leaks = sources.filter((path) => FORBIDDEN_PATTERN.test(readFileSync(path, 'utf8')))
  push(
    'AI route and tools contain no secret keys or service-role usage',
    leaks.length === 0,
    leaks.length === 0 ? `scanned ${sources.length} files` : `flagged: ${leaks.join(', ')}`
  )

  const routeSource = readFileSync(join(process.cwd(), 'app/api/ai/project/route.ts'), 'utf8')
  push(
    'AI route checks the session and streams the response',
    routeSource.includes('getClaims') && routeSource.includes('toUIMessageStreamResponse'),
    'getClaims + toUIMessageStreamResponse present'
  )

  const anonymousStatus = await postAi(origin, { projectId: crypto.randomUUID(), question: 'halo' }, {})
  push('anonymous request to the AI endpoint is rejected with 401', anonymousStatus === 401, `status=${anonymousStatus}`)

  const sessionStatus = await postAi(origin, {}, authed)
  if (sessionStatus !== 400) {
    push('authenticated session reaches request validation', false, `status=${sessionStatus} (expected 400 for an empty body)`)
    return respond(false)
  }
  push('authenticated session reaches request validation', true, `status=${sessionStatus}`)

  const missingProjectStatus = await postAi(origin, { question: 'halo' }, authed)
  push('request without projectId is rejected with 400', missingProjectStatus === 400, `status=${missingProjectStatus}`)

  const missingQuestionStatus = await postAi(origin, { projectId: crypto.randomUUID() }, authed)
  push('request without question is rejected with 400', missingQuestionStatus === 400, `status=${missingQuestionStatus}`)

  const oversizedStatus = await postAi(
    origin,
    { projectId: crypto.randomUUID(), question: 'x'.repeat(MAX_QUESTION_LENGTH + 1) },
    authed
  )
  push(
    `question longer than ${MAX_QUESTION_LENGTH} characters is rejected with 400`,
    oversizedStatus === 400,
    `status=${oversizedStatus}`
  )

  const invalidUuidStatus = await postAi(origin, { projectId: 'not-a-uuid', question: 'halo' }, authed)
  push('malformed projectId is rejected with 404', invalidUuidStatus === 404, `status=${invalidUuidStatus}`)

  const probe = request.nextUrl.searchParams.get('probe')
  const foreignProjectId = probe && UUID_PATTERN.test(probe) ? probe : crypto.randomUUID()
  const foreignStatus = await postAi(origin, { projectId: foreignProjectId, question: 'halo' }, authed)
  push(
    'project the user cannot access is rejected with 404',
    foreignStatus === 404,
    `status=${foreignStatus}, probe=${probe ? 'foreign project id supplied' : 'random uuid'}`
  )

  return respond(true)
}
