/**
 * Google Gemini BYOK Client
 *
 * Direct-to-provider client for Practice/Enterprise users who bring
 * their own Google AI API key. Maps the Psygil-standard request to
 * Gemini's generateContent format and normalizes the response.
 */

import type { AiCompletionRequest, AiCompletionResponse } from './provider'

const TIMEOUT_MS = 60_000

function getGeminiUrl(model: string, apiKey: string): string {
  const m = model || 'gemini-1.5-pro'
  return `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
}

interface GeminiCandidate {
  readonly content: {
    readonly parts: readonly { readonly text: string }[]
  }
  readonly finishReason: string
}

interface GeminiResponse {
  readonly candidates: readonly GeminiCandidate[]
  readonly usageMetadata: {
    readonly promptTokenCount: number
    readonly candidatesTokenCount: number
  }
  readonly modelVersion?: string
}

export async function callGemini(
  apiKey: string,
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const model = request.model ?? 'gemini-1.5-pro'

  // Gemini uses a different message structure: system instruction is separate,
  // and user content goes in contents[].parts[].
  const body = {
    systemInstruction: {
      parts: [{ text: request.systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: request.userMessage }],
      },
    ],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0,
    },
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(getGeminiUrl(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (response.status === 400) {
      let msg = 'Invalid request to Gemini API'
      try {
        const err = await response.json()
        if ((err as { error?: { message?: string } }).error?.message) {
          msg = (err as { error: { message: string } }).error.message
        }
      } catch { /* use default */ }
      throw new Error(msg)
    }

    if (response.status === 403) {
      throw new Error('Invalid or unauthorized Google AI API key. Check your key in Settings > AI.')
    }

    if (response.status === 429) {
      throw new Error('Google AI rate limit reached. Wait a moment and try again.')
    }

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`)
    }

    const data = (await response.json()) as GeminiResponse
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? ''

    return {
      content: text,
      model: data.modelVersion ?? model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      stopReason: candidate?.finishReason ?? 'STOP',
      provider: 'google',
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('Gemini request timed out after 60 seconds.')
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
