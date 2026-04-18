import type { ProxyRequest, ProxyResponse } from '../types.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessage {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

function isAnthropicMessage(val: unknown): val is AnthropicMessage {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v['model'] === 'string' &&
    typeof v['stop_reason'] === 'string' &&
    typeof v['usage'] === 'object' &&
    v['usage'] !== null &&
    Array.isArray(v['content'])
  );
}

export async function callAnthropic(apiKey: string, request: ProxyRequest): Promise<ProxyResponse> {
  const body = {
    model: request.model ?? 'claude-sonnet-4-20250514',
    max_tokens: request.maxTokens ?? 4096,
    messages: request.messages,
    ...(request.system ? { system: request.system } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data: unknown = await response.json();

  if (!isAnthropicMessage(data)) {
    throw new Error('Unexpected response shape from Anthropic API');
  }

  const textBlock = data.content.find((c) => c.type === 'text');
  const content = textBlock?.text ?? '';

  return {
    content,
    model: data.model,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    stopReason: data.stop_reason,
    provider: 'anthropic',
  };
}
