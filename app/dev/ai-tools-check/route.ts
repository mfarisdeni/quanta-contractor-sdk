import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'
import { createQuantaTools, type ToolFailure, type ToolResult } from '@/lib/ai/tools'
import { createClient } from '@/lib/supabase/server'

type Check = {
  name: string
  pass: boolean | null
  detail: string
}

const MUTATION_PATTERN = /\.(insert|update|delete|upsert|rpc)\s*\(/
const OUTPUT_LEAK_PATTERN = /sb_secret_|sb_pub_|gsk_[A-Za-z0-9]{10,}|access_token|refresh_token|service_role|Bearer /

const PROJECT_KEYS = ['id', 'name', 'project_code', 'status', 'description', 'client_name', 'contractor_name', 'location', 'start_date', 'end_date', 'budget', 'currency']
const MILESTONE_KEYS = ['id', 'name', 'status', 'planned_start_date', 'due_date', 'completed_at']
const TASK_KEYS = ['id', 'title', 'status', 'priority', 'progress_percent', 'start_date', 'due_date', 'completed_at']
const RISK_KEYS = ['id', 'title', 'severity', 'status', 'category', 'probability', 'impact', 'risk_score', 'due_date']
const SIGNAL_KEYS = ['id', 'title', 'signal_type', 'severity', 'status', 'detected_at', 'resolved_at']

const DEV_OPTIONS = { toolCallId: 'dev-check', messages: [] as never[] } as never

function sortedKeys(row: object | null | undefined) {
  return Object.keys(row ?? {}).sort()
}

function keysEqual(row: object | null | undefined, expected: string[]) {
  const keys = sortedKeys(row)
  return keys.length === expected.length && expected.every((key) => keys.includes(key))
}

function failed(result: ToolResult | undefined): result is ToolFailure {
  return result?.ok === false
}

function failureCode(result: ToolResult | undefined) {
  return failed(result) ? result.error : 'unexpected-success'
}

function okData<T>(result: ToolResult | undefined): T | undefined {
  return result?.ok === true ? (result.data as T) : undefined
}

function asItems(data: unknown) {
  return (data as { items?: Array<Record<string, unknown>> } | undefined)?.items ?? []
}

async function run<T extends ToolResult>(toolCall: T | PromiseLike<T> | AsyncIterable<T>): Promise<T> {
  return (await toolCall) as T
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const checks: Check[] = []
  const push = (name: string, pass: boolean | null, detail: string) => checks.push({ name, pass, detail })

  const toolsDir = join(process.cwd(), 'lib', 'ai', 'tools')
  const toolSources = readdirSync(toolsDir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, source: readFileSync(join(toolsDir, name), 'utf8') }))
  const mutating = toolSources.filter(({ source }) => MUTATION_PATTERN.test(source))
  push(
    'AI tools are read-only (no insert/update/delete/upsert/rpc in tool sources)',
    mutating.length === 0,
    mutating.length === 0 ? `scanned ${toolSources.length} files` : `flagged: ${mutating.map(({ name }) => name).join(', ')}`
  )

  const supabase = await createClient()
  const { data: session } = await supabase.auth.getClaims()
  if (!session?.claims?.sub) {
    return NextResponse.json({ dev: true, authenticated: false, probe: null, checks, ok: false })
  }

  const probe = request.nextUrl.searchParams.get('probe')

  if (probe) {
    const tools = createQuantaTools({ supabase, projectId: probe })

    const projectResult = await run(tools.get_project.execute({ projectId: probe }, DEV_OPTIONS))
    push(
      'get_project cannot access a project the user cannot read (RLS)',
      failed(projectResult) && projectResult.error === 'PROJECT_NOT_FOUND',
      `result=${failureCode(projectResult)}`
    )

    for (const [name, runner] of [
      ['get_milestones', tools.get_milestones],
      ['get_tasks', tools.get_tasks],
      ['get_risks', tools.get_risks],
      ['get_signals', tools.get_signals],
    ] as const) {
      const result = await run(runner.execute({ projectId: probe }, DEV_OPTIONS))
      const items = asItems(okData(result))
      push(
        `${name} returns no rows for an inaccessible project (RLS)`,
        result?.ok === true && items.length === 0,
        `count=${items.length}`
      )
    }
  } else {
    const { data: projects } = await supabase.from('projects').select('id').order('created_at', { ascending: false }).limit(1)
    if (!projects?.length) {
      push('tool layer has an accessible project to inspect', false, 'no accessible project for this user')
    } else {
      const projectId = projects[0].id
      const tools = createQuantaTools({ supabase, projectId })

      const projectResult = await run(tools.get_project.execute({ projectId }, DEV_OPTIONS))
      const project = okData<{ project: Record<string, unknown> }>(projectResult)
      push('get_project returns the authorized project', project?.project?.id === projectId, project?.project?.id ? 'matched' : 'missing')
      push('get_project output contains only intended fields', keysEqual(project?.project, PROJECT_KEYS), `keys=${JSON.stringify(sortedKeys(project?.project))}`)

      const milestonesResult = await run(tools.get_milestones.execute({ projectId }, DEV_OPTIONS))
      const milestoneItems = asItems(okData(milestonesResult))
      push('get_milestones returns the project milestones', milestonesResult?.ok === true && milestoneItems.length > 0, `count=${milestoneItems.length}`)
      push(
        'get_milestones output contains only intended fields',
        milestoneItems.every((row) => keysEqual(row, MILESTONE_KEYS)),
        `rows=${milestoneItems.length}`
      )

      const tasksMaxResult = await run(tools.get_tasks.execute({ projectId, limit: 100 }, DEV_OPTIONS))
      const tasksMax = asItems(okData(tasksMaxResult))
      push('get_tasks respects the maximum limit (100)', tasksMaxResult?.ok === true && tasksMax.length === 100, `count=${tasksMax.length}`)

      const tasksDefaultResult = await run(tools.get_tasks.execute({ projectId }, DEV_OPTIONS))
      const taskDefaults = asItems(okData(tasksDefaultResult))
      push('get_tasks uses the default limit (50)', tasksDefaultResult?.ok === true && taskDefaults.length === 50, `count=${taskDefaults.length}`)

      const tasksClampedResult = await run(tools.get_tasks.execute({ projectId, limit: 1000 }, DEV_OPTIONS))
      push(
        'get_tasks clamps over-limit requests to the maximum',
        tasksClampedResult?.ok === true && asItems(okData(tasksClampedResult)).length === 100,
        `count=${asItems(okData(tasksClampedResult)).length}`
      )
      push(
        'get_tasks output contains only intended fields',
        tasksMax.every((row) => keysEqual(row, TASK_KEYS)),
        `rows=${tasksMax.length}`
      )

      const tasksFilteredResult = await run(tools.get_tasks.execute({ projectId, status: 'blocked' }, DEV_OPTIONS))
      const taskFiltered = asItems(okData(tasksFilteredResult))
      push(
        'get_tasks status filter returns only matching tasks',
        taskFiltered.length > 0 && taskFiltered.every((row) => row.status === 'blocked'),
        `count=${taskFiltered.length}`
      )

      const risksFilteredResult = await run(tools.get_risks.execute({ projectId, severity: 'critical' }, DEV_OPTIONS))
      const riskFiltered = asItems(okData(risksFilteredResult))
      push(
        'get_risks severity filter returns only matching risks',
        riskFiltered.length > 0 && riskFiltered.every((row) => row.severity === 'critical'),
        `count=${riskFiltered.length}`
      )
      push(
        'get_risks output contains only intended fields',
        riskFiltered.every((row) => keysEqual(row, RISK_KEYS)),
        `rows=${riskFiltered.length}`
      )

      const risksAllResult = await run(tools.get_risks.execute({ projectId }, DEV_OPTIONS))
      const riskItems = asItems(okData(risksAllResult))
      push('get_risks returns the project risks', risksAllResult?.ok === true && riskItems.length > 0, `count=${riskItems.length}`)

      const signalsFilteredResult = await run(tools.get_signals.execute({ projectId, severity: 'high' }, DEV_OPTIONS))
      const signalFiltered = asItems(okData(signalsFilteredResult))
      push(
        'get_signals severity filter returns only matching signals',
        signalFiltered.length > 0 && signalFiltered.every((row) => row.severity === 'high'),
        `count=${signalFiltered.length}`
      )
      push(
        'get_signals output contains only intended fields',
        signalFiltered.every((row) => keysEqual(row, SIGNAL_KEYS)),
        `rows=${signalFiltered.length}`
      )

      const signalsAllResult = await run(tools.get_signals.execute({ projectId }, DEV_OPTIONS))
      const signalItems = asItems(okData(signalsAllResult))
      push('get_signals returns the project signals', signalsAllResult?.ok === true && signalItems.length > 0, `count=${signalItems.length}`)

      const invalidUuidResult = await run(tools.get_tasks.execute({ projectId: 'not-a-uuid' }, DEV_OPTIONS))
      push(
        'get_tasks rejects an invalid UUID with INVALID_INPUT',
        failed(invalidUuidResult) && invalidUuidResult.error === 'INVALID_INPUT',
        `result=${failureCode(invalidUuidResult)}`
      )

      const invalidUuidProjectResult = await run(tools.get_project.execute({ projectId: 'not-a-uuid' }, DEV_OPTIONS))
      push(
        'get_project rejects an invalid UUID with INVALID_INPUT',
        failed(invalidUuidProjectResult) && invalidUuidProjectResult.error === 'INVALID_INPUT',
        `result=${failureCode(invalidUuidProjectResult)}`
      )

      const wrongScopeResults = [
        ['get_project', await run(tools.get_project.execute({ projectId: crypto.randomUUID() }, DEV_OPTIONS))],
        ['get_milestones', await run(tools.get_milestones.execute({ projectId: crypto.randomUUID() }, DEV_OPTIONS))],
        ['get_tasks', await run(tools.get_tasks.execute({ projectId: crypto.randomUUID() }, DEV_OPTIONS))],
        ['get_risks', await run(tools.get_risks.execute({ projectId: crypto.randomUUID() }, DEV_OPTIONS))],
        ['get_signals', await run(tools.get_signals.execute({ projectId: crypto.randomUUID() }, DEV_OPTIONS))],
      ] as const
      for (const [name, result] of wrongScopeResults) {
        push(
          `${name} rejects a non-authorized project id`,
          failed(result) && result.error === 'PROJECT_NOT_FOUND',
          `result=${failureCode(result)}`
        )
      }

      const badStatusResult = await run(tools.get_tasks.execute({ projectId, status: 'bogus' }, DEV_OPTIONS))
      push(
        'get_tasks rejects an invalid status filter',
        failed(badStatusResult) && badStatusResult.error === 'INVALID_INPUT',
        `result=${failureCode(badStatusResult)}`
      )

      const badSeverityResult = await run(tools.get_risks.execute({ projectId, severity: 'bogus' }, DEV_OPTIONS))
      push(
        'get_risks rejects an invalid severity filter',
        failed(badSeverityResult) && badSeverityResult.error === 'INVALID_INPUT',
        `result=${failureCode(badSeverityResult)}`
      )

      const badRiskStatusResult = await run(tools.get_risks.execute({ projectId, status: 'bogus' }, DEV_OPTIONS))
      push(
        'get_risks rejects an invalid status filter',
        failed(badRiskStatusResult) && badRiskStatusResult.error === 'INVALID_INPUT',
        `result=${failureCode(badRiskStatusResult)}`
      )

      const badSignalSeverityResult = await run(tools.get_signals.execute({ projectId, severity: 'bogus' }, DEV_OPTIONS))
      push(
        'get_signals rejects an invalid severity filter',
        failed(badSignalSeverityResult) && badSignalSeverityResult.error === 'INVALID_INPUT',
        `result=${failureCode(badSignalSeverityResult)}`
      )

      const badSignalStatusResult = await run(tools.get_signals.execute({ projectId, status: 'bogus' }, DEV_OPTIONS))
      push(
        'get_signals rejects an invalid status filter',
        failed(badSignalStatusResult) && badSignalStatusResult.error === 'INVALID_INPUT',
        `result=${failureCode(badSignalStatusResult)}`
      )

      const badLimitResult = await run(tools.get_signals.execute({ projectId, limit: -5 }, DEV_OPTIONS))
      push(
        'get_signals falls back to the default limit for an invalid limit',
        badLimitResult?.ok === true && asItems(okData(badLimitResult)).length <= 50,
        `count=${asItems(okData(badLimitResult)).length}`
      )

      const outputSample = JSON.stringify({
        project: project?.project,
        milestones: milestoneItems,
        tasks: tasksMax,
        risks: riskItems,
        signals: signalItems,
      })
      push(
        'tool output contains no credentials or auth material',
        !OUTPUT_LEAK_PATTERN.test(outputSample),
        `sampled ${outputSample.length} characters of tool output`
      )
    }
  }

  const ok = checks.every((check) => check.pass !== false)

  return NextResponse.json(
    { dev: true, authenticated: true, probe: probe ?? null, checks, ok },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}