import { createGetMilestonesTool } from './get-milestones'
import { createGetProjectTool } from './get-project'
import { createGetRisksTool } from './get-risks'
import { createGetSignalsTool } from './get-signals'
import { createGetTasksTool } from './get-tasks'
import type { ToolContext } from './shared'

export type { AiSupabaseClient, ToolContext, ToolFailure, ToolResult, ToolSuccess } from './shared'

export function createQuantaTools(context: ToolContext) {
  return {
    get_project: createGetProjectTool(context),
    get_milestones: createGetMilestonesTool(context),
    get_tasks: createGetTasksTool(context),
    get_risks: createGetRisksTool(context),
    get_signals: createGetSignalsTool(context),
  }
}