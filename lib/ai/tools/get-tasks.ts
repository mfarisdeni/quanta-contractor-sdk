import { tool } from 'ai'
import { z } from 'zod'
import { clampLimit, guardToolCall, INVALID_INPUT, type ToolContext } from './shared'

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'completed', 'cancelled'] as const
const TASK_SELECT = 'id, title, status, priority, progress_percent, start_date, due_date, completed_at'
const TASK_DEFAULT_LIMIT = 50
const TASK_MAX_LIMIT = 100

export function createGetTasksTool(context: ToolContext) {
  return tool({
    description: `List project tasks ordered by due date (earliest first). Optional status filter: ${TASK_STATUSES.join(', ')}. Default limit ${TASK_DEFAULT_LIMIT}, maximum ${TASK_MAX_LIMIT}.`,
    inputSchema: z.object({
      projectId: z.string().optional().describe('The authorized project id. May be omitted; it is supplied server-side.'),
      status: z.string().optional().describe(`Filter tasks by status: ${TASK_STATUSES.join(', ')}`),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Maximum number of tasks to return (default ${TASK_DEFAULT_LIMIT}, max ${TASK_MAX_LIMIT})`),
    }),
    execute: (input) =>
      guardToolCall(context, 'get_tasks', input, async (projectId) => {
        if (input.status && !(TASK_STATUSES as readonly string[]).includes(input.status)) return INVALID_INPUT
        const limit = clampLimit(input.limit, TASK_DEFAULT_LIMIT, TASK_MAX_LIMIT)
        let query = context.supabase.from('tasks').select(TASK_SELECT).eq('project_id', projectId)
        if (input.status) query = query.eq('status', input.status)
        const { data, error } = await query
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(limit)
        if (error) throw error
        return { ok: true, data: { items: data, count: data.length } }
      }),
  })
}