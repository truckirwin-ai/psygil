import type { ProxyRequest, ProxyResponse } from '../types.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata: GeminiUsage;
  modelVersion?: string;
}

function isGeminiResponse(val: unknown): val is GeminiResponse {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return Array.isArray(v['candidates']) && typeof v['usageMetadata'] === 'object';
}

export async function callGemini(apiKey: string, request: ProxyRequest): Promise<ProxyResponse> {
  const model = request.model ?? 'gemini-1.5-flash';

  const contents: GeminiContent[] = request.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };

  if (request.system) {
    body['systemInstruction'] = { parts: [{ text: request.system }] };
  }

  if (request.maxTokens !== undefined || request.temperature !== undefined) {
    body['generationConfig'] = {
      ...(request.maxTokens !== undefined ? { maxOutputTokens: request.maxTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };
  }

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data: unknown = await response.json();

  if (!isGeminiResponse(data)) {
    throw new Error('Unexpected response shape from Gemini API');
  }

  const candidate = data.candidates[0];
  if (!candidate) {
    throw new Error('Gemini returned no candidates');
  }

  const text = candidate.content.parts.map((p) => p.text).join('');

  return {
    content: text,
    model: data.modelVersion ?? model,
    inputTokens: data.usageMetadata.promptTokenCount,
    outputTokens: data.usageMetadata.candidatesTokenCount,
    stopReason: candidate.finishReason,
    provider: 'google',
  };
}
