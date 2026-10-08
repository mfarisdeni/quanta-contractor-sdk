import { tool } from 'ai'
import { z } from 'zod'
import { clampLimit, guardToolCall, INVALID_INPUT, type ToolContext } from './shared'

const RISK_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
const RISK_STATUSES = ['open', 'monitoring', 'mitigated', 'closed'] as const
const RISK_SELECT = 'id, title, severity, status, category, probability, impact, risk_score, due_date'
const RISK_DEFAULT_LIMIT = 50
const RISK_MAX_LIMIT = 100

export function createGetRisksTool(context: ToolContext) {
  return tool({
    description: `List project risks ordered by due date (earliest first). Optional severity filter: ${RISK_SEVERITIES.join(', ')}. Optional status filter: ${RISK_STATUSES.join(', ')}. Default limit ${RISK_DEFAULT_LIMIT}, maximum ${RISK_MAX_LIMIT}.`,
    inputSchema: z.object({
      projectId: z.string().optional().describe('The authorized project id. May be omitted; it is supplied server-side.'),
      severity: z.string().optional().describe(`Filter by severity: ${RISK_SEVERITIES.join(', ')}`),
      status: z.string().optional().describe(`Filter by status: ${RISK_STATUSES.join(', ')}`),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Maximum number of risks to return (default ${RISK_DEFAULT_LIMIT}, max ${RISK_MAX_LIMIT})`),
    }),
    execute: (input) =>
      guardToolCall(context, 'get_risks', input, async (projectId) => {
        if (input.severity && !(RISK_SEVERITIES as readonly string[]).includes(input.severity)) return INVALID_INPUT
        if (input.status && !(RISK_STATUSES as readonly string[]).includes(input.status)) return INVALID_INPUT
        const limit = clampLimit(input.limit, RISK_DEFAULT_LIMIT, RISK_MAX_LIMIT)
        let query = context.supabase.from('risks').select(RISK_SELECT).eq('project_id', projectId)
        if (input.severity) query = query.eq('severity', input.severity)
        if (input.status) query = query.eq('status', input.status)
        const { data, error } = await query
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(limit)
        if (error) throw error
        return { ok: true, data: { items: data, count: data.length } }
      }),
  })
}