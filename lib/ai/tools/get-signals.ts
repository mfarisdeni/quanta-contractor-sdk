import { tool } from 'ai'
import { z } from 'zod'
import { clampLimit, guardToolCall, INVALID_INPUT, type ToolContext } from './shared'

const SIGNAL_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
const SIGNAL_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const
const SIGNAL_SELECT = 'id, title, signal_type, severity, status, detected_at, resolved_at'
const SIGNAL_DEFAULT_LIMIT = 50
const SIGNAL_MAX_LIMIT = 100

export function createGetSignalsTool(context: ToolContext) {
  return tool({
    description: `List project signals (monitoring alerts) ordered by detection time (most recent first). Optional severity filter: ${SIGNAL_SEVERITIES.join(', ')}. Optional status filter: ${SIGNAL_STATUSES.join(', ')}. Default limit ${SIGNAL_DEFAULT_LIMIT}, maximum ${SIGNAL_MAX_LIMIT}.`,
    inputSchema: z.object({
      projectId: z.string().optional().describe('The authorized project id. May be omitted; it is supplied server-side.'),
      severity: z.string().optional().describe(`Filter by severity: ${SIGNAL_SEVERITIES.join(', ')}`),
      status: z.string().optional().describe(`Filter by status: ${SIGNAL_STATUSES.join(', ')}`),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Maximum number of signals to return (default ${SIGNAL_DEFAULT_LIMIT}, max ${SIGNAL_MAX_LIMIT})`),
    }),
    execute: (input) =>
      guardToolCall(context, 'get_signals', input, async (projectId) => {
        if (input.severity && !(SIGNAL_SEVERITIES as readonly string[]).includes(input.severity)) return INVALID_INPUT
        if (input.status && !(SIGNAL_STATUSES as readonly string[]).includes(input.status)) return INVALID_INPUT
        const limit = clampLimit(input.limit, SIGNAL_DEFAULT_LIMIT, SIGNAL_MAX_LIMIT)
        let query = context.supabase.from('signals').select(SIGNAL_SELECT).eq('project_id', projectId)
        if (input.severity) query = query.eq('severity', input.severity)
        if (input.status) query = query.eq('status', input.status)
        const { data, error } = await query.order('detected_at', { ascending: false }).limit(limit)
        if (error) throw error
        return { ok: true, data: { items: data, count: data.length } }
      }),
  })
}