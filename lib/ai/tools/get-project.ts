import { tool } from 'ai'
import { z } from 'zod'
import { guardToolCall, PROJECT_NOT_FOUND, QUERY_FAILED, type AiSupabaseClient, type ToolContext, type ToolResult } from './shared'

const PROJECT_SELECT =
  'id, name, project_code, status, description, client_name, contractor_name, location, start_date, end_date, budget, currency'

export type GetProjectResult = ToolResult<{ project: Record<string, unknown> }>

export async function queryProject(supabase: AiSupabaseClient, projectId: string): Promise<GetProjectResult> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', projectId)
    .maybeSingle()
  if (error) return QUERY_FAILED
  if (!data) return PROJECT_NOT_FOUND
  return { ok: true, data: { project: data } }
}

export function createGetProjectTool(context: ToolContext) {
  return tool({
    description:
      'Get the current authorized project. Use first to learn the project name, code, status, description, client, contractor, location, dates, and budget.',
    inputSchema: z.object({
      projectId: z.string().optional().describe('The authorized project id. May be omitted; it is supplied server-side.'),
    }),
    execute: (input) =>
      guardToolCall(context, 'get_project', input, (projectId) => queryProject(context.supabase, projectId)),
  })
}