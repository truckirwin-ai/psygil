/**
 * OpenAI BYOK Client
 *
 * Direct-to-provider client for Practice/Enterprise users who bring
 * their own OpenAI API key. Maps the Psygil-standard request to
 * OpenAI's ChatCompletion format and normalizes the response.
 */

import type { AiCompletionRequest, AiCompletionResponse } from './provider'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const TIMEOUT_MS = 60_000

interface OpenAiChoice {
  readonly message: { readonly content: string }
  readonly finish_reason: string
}

interface OpenAiResponse {
  readonly id: string
  readonly model: string
  readonly choices: readonly OpenAiChoice[]
  readonly usage: {
    readonly prompt_tokens: number
    readonly completion_tokens: number
  }
}

export async function callOpenAi(
  apiKey: string,
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const model = request.model ?? 'gpt-4o'

  const body = {
    model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userMessage },
    ],
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (response.status === 401) {
      throw new Error('Invalid OpenAI API key. Check your key in Settings > AI.')
    }

    if (response.status === 429) {
      throw new Error('OpenAI rate limit reached. Wait a moment and try again.')
    }

    if (!response.ok) {
      let msg = `OpenAI API returned status ${response.status}`
      try {
        const err = await response.json()
        if ((err as { error?: { message?: string } }).error?.message) {
          msg = (err as { error: { message: string } }).error.message
        }
      } catch { /* use default */ }
      throw new Error(msg)
    }

    const data = (await response.json()) as OpenAiResponse
    const choice = data.choices[0]

    return {
      content: choice?.message?.content ?? '',
      model: data.model,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      stopReason: choice?.finish_reason ?? 'stop',
      provider: 'openai',
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('OpenAI request timed out after 60 seconds.')
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
