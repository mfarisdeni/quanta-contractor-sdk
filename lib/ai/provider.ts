import { createGroq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'

export const QUANTA_AI_MODEL_ID = 'openai/gpt-oss-20b'

export function isAiConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}

export function createAiModel(): LanguageModel {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
  return groq.languageModel(QUANTA_AI_MODEL_ID)
}
