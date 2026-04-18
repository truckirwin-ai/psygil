// Shared type definitions for the API gateway

export type Provider = 'anthropic' | 'openai' | 'google';
export type Tier = 'trial' | 'solo' | 'practice' | 'enterprise';

export interface ProxyRequest {
  messages: MessageParam[];
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface MessageParam {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProxyResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  provider: Provider;
}

export interface RoutingConfig {
  defaultProvider: Provider;
  defaultModel: string;
  fallbackProvider?: Provider;
  fallbackModel?: string;
  tierOverrides?: Partial<Record<Tier, { provider?: Provider; model?: string }>>;
  overageRateMultiplier?: number;
}

export interface ProviderKeyEntry {
  provider: Provider;
  key: string;
  label?: string;
  createdAt: string;
}

export interface MonthlyUsage {
  licenseKey: string;
  period: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  models: Record<string, number>;
  providers: Record<string, number>;
}

export interface AggregateUsage {
  period: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byLicense: Record<string, MonthlyUsage>;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  estimatedCostUsd: number;
}
