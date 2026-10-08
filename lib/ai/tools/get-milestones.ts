import { tool } from 'ai'
import { z } from 'zod'
import { guardToolCall, type ToolContext } from './shared'

const MILESTONE_SELECT = 'id, name, status, planned_start_date, due_date, completed_at'

export function createGetMilestonesTool(context: ToolContext) {
  return tool({
    description:
      'List the project milestones with their status, planned start date, due date, and completion date. Ordered by due date, then planned start date.',
    inputSchema: z.object({
      projectId: z.string().optional().describe('The authorized project id. May be omitted; it is supplied server-side.'),
    }),
    execute: (input) =>
      guardToolCall(context, 'get_milestones', input, async (projectId) => {
        const { data, error } = await context.supabase
          .from('milestones')
          .select(MILESTONE_SELECT)
          .eq('project_id', projectId)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('planned_start_date', { ascending: true, nullsFirst: false })
          .limit(100)
        if (error) throw error
        return { ok: true, data: { items: data, count: data.length } }
      }),
  })
}