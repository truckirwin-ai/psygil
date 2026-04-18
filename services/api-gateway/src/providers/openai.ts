import type { ProxyRequest, ProxyResponse } from '../types.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAiChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface OpenAiResponse {
  model: string;
  choices: OpenAiChoice[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

function isOpenAiResponse(val: unknown): val is OpenAiResponse {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v['model'] === 'string' &&
    Array.isArray(v['choices']) &&
    typeof v['usage'] === 'object' &&
    v['usage'] !== null
  );
}

export async function callOpenAi(apiKey: string, request: ProxyRequest): Promise<ProxyResponse> {
  const messages: Array<{ role: string; content: string }> = [];

  if (request.system) {
    messages.push({ role: 'system', content: request.system });
  }
  for (const m of request.messages) {
    messages.push({ role: m.role, content: m.content });
  }

  const body = {
    model: request.model ?? 'gpt-4o',
    messages,
    max_tokens: request.maxTokens ?? 4096,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data: unknown = await response.json();

  if (!isOpenAiResponse(data)) {
    throw new Error('Unexpected response shape from OpenAI API');
  }

  const choice = data.choices[0];
  if (!choice) {
    throw new Error('OpenAI returned no choices');
  }

  return {
    content: choice.message.content,
    model: data.model,
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
    stopReason: choice.finish_reason,
    provider: 'openai',
  };
}
