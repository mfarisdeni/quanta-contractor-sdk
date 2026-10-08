'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { buttonVariants, Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STARTER_QUESTIONS = [
  'What is the current project status?',
  'What are the biggest risks?',
  'Which milestones need attention?',
  'What should the PM focus on next?',
]

const inputClass =
  'h-9 w-full min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function hasToolInFlight(message: UIMessage | undefined) {
  return (message?.parts ?? []).some((part) => {
    const type = (part as { type: string }).type
    if (type !== 'dynamic-tool' && !type.startsWith('tool-')) return false
    const state = (part as { state?: string }).state
    return state !== 'result' && state !== 'error'
  })
}

function latestUserQuestion(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'user') continue
    const text = message.parts
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join(' ')
      .trim()
    if (text) return text
  }
  return ''
}

type AskAiPanelProps = {
  projectId: string
  projectName: string
  projectCode: string
}

export function AskAiPanel({ projectId, projectName, projectCode }: AskAiPanelProps) {
  const [input, setInput] = useState('')
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/project',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { projectId, question: latestUserQuestion(messages) },
        }),
      }),
    [projectId]
  )
  const { messages, sendMessage, status, error, clearError } = useChat({ transport })
  const busy = status === 'submitted' || status === 'streaming'

  function ask(value: string) {
    const text = value.trim()
    if (!text || busy) return
    setInput('')
    clearError()
    void sendMessage({ text })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    ask(input)
  }

  return (
    <Card className="mt-6 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-amber-500" />
            Tanya AI
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {projectName} · {projectCode} · Jawaban hanya berdasarkan data proyek ini.
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Mulai dengan pertanyaan contoh:</p>
            <div className="flex flex-wrap gap-2">
              {STARTER_QUESTIONS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => ask(starter)}
                  disabled={busy}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'max-w-[85%] self-end rounded-lg bg-muted px-3 py-2 text-sm'
                    : 'max-w-[95%] whitespace-pre-wrap self-start rounded-lg border border-border bg-background px-3 py-2 text-sm'
                }
              >
                {message.parts.map((part, index) => (part.type === 'text' ? <span key={index}>{part.text}</span> : null))}
              </div>
            ))}
            {status === 'submitted' && <p className="text-xs text-muted-foreground">Memikirkan jawaban…</p>}
            {hasToolInFlight(messages[messages.length - 1]) && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Checking project data...
              </p>
            )}
            {status === 'streaming' && <p className="text-xs text-muted-foreground">Menjawab…</p>}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error.message}
          </p>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tanyakan sesuatu tentang proyek ini"
            aria-label="Pertanyaan untuk Quanta AI"
            className={inputClass}
          />
          <Button type="submit" disabled={busy || input.trim().length === 0}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send />}
            <span className="hidden sm:inline">{busy ? 'Menjawab' : 'Ask AI'}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}