import { QUANTA_AI_MODEL_ID } from '../provider'
import type { createClient } from '../../supabase/server'

export type AiSupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ToolContext = {
  supabase: AiSupabaseClient
  projectId: string
}

export type ToolSuccess<T = unknown> = { ok: true; data: T }
export type ToolFailure = { ok: false; error: string }
export type ToolResult<T = unknown> = ToolSuccess<T> | ToolFailure

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const INVALID_INPUT: ToolFailure = { ok: false, error: 'INVALID_INPUT' }
export const PROJECT_NOT_FOUND: ToolFailure = { ok: false, error: 'PROJECT_NOT_FOUND' }
export const QUERY_FAILED: ToolFailure = { ok: false, error: 'QUERY_FAILED' }

export function clampLimit(limit: number | undefined, fallback: number, max: number) {
  const parsed = typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : fallback
  return Math.min(parsed, max)
}

export function logToolCall(projectId: string, tool: string, ok: boolean, ms: number) {
  console.info('[ai] tool', { projectId, model: QUANTA_AI_MODEL_ID, tool, ok, ms })
}

export type GuardedInput = { projectId?: string }

export async function guardToolCall<T extends GuardedInput>(
  context: ToolContext,
  toolName: string,
  input: T,
  run: (projectId: string) => ToolResult | Promise<ToolResult>
): Promise<ToolResult> {
  const startedAt = Date.now()
  const fail = (result: ToolFailure): ToolFailure => {
    logToolCall(context.projectId, toolName, false, Date.now() - startedAt)
    return result
  }
  const projectId = input.projectId ?? context.projectId
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) {
    return fail(INVALID_INPUT)
  }
  if (projectId !== context.projectId) {
    return fail(PROJECT_NOT_FOUND)
  }
  try {
    const result = await run(projectId)
    logToolCall(context.projectId, toolName, result?.ok !== false, Date.now() - startedAt)
    return result
  } catch {
    return fail(QUERY_FAILED)
  }
}