import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai'
import { createAiModel, QUANTA_AI_MODEL_ID } from './provider'
import { createQuantaTools } from './tools'
import type { ToolContext } from './tools/shared'

export const QUANTA_AGENT_ID = 'quanta-project-agent'
export const QUANTA_AGENT_MAX_STEPS = 8

export const AGENT_INSTRUCTION = `You are Quanta AI, an assistant for construction project monitoring.

You have read-only tools for retrieving project information.

Use tools when the user's question requires project data.

Never invent project facts.

Treat tool results as the source of truth.

Distinguish facts from inference.

If data is missing, say so.

Never claim that a project fact exists without retrieving it.

You may summarize and reason over retrieved data, but you must not modify project data.

Call tools in parallel whenever possible.

Produce a final answer as soon as you have enough information; do not call more tools if you can already answer.`

export type QuantaProjectAgent = ReturnType<typeof createQuantaProjectAgent>

export function createQuantaProjectAgent(
  context: ToolContext,
  options: { model?: LanguageModel; maxSteps?: number } = {}
) {
  let currentStep = -1
  const maxSteps = options.maxSteps ?? QUANTA_AGENT_MAX_STEPS
  return new ToolLoopAgent({
    id: QUANTA_AGENT_ID,
    model: options.model ?? createAiModel(),
    tools: createQuantaTools(context),
    instructions: AGENT_INSTRUCTION,
    stopWhen: stepCountIs(maxSteps),
    runtimeContext: { projectId: context.projectId },
    onStepStart({ stepNumber }) {
      currentStep = stepNumber
    },
    onToolExecutionEnd(event) {
      const succeeded =
        event.toolOutput.type === 'tool-result' &&
        (event.toolOutput.output as { ok?: boolean } | undefined)?.ok !== false
      console.info('[quanta-agent] tool', {
        projectId: context.projectId,
        model: QUANTA_AI_MODEL_ID,
        toolName: event.toolCall.toolName,
        step: currentStep,
        duration: event.toolExecutionMs,
        success: succeeded,
      })
    },
  })
}