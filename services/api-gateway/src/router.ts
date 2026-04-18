// Determines the provider and model to use for a given request + tier.
import type { Provider, Tier, ProxyRequest, RoutingConfig } from './types.js';
import { getRoutingConfig, getProviderKey } from './config.js';
import { callAnthropic } from './providers/anthropic.js';
import { callOpenAi } from './providers/openai.js';
import { callGemini } from './providers/google.js';
import type { ProxyResponse } from './types.js';

const TIERS_ALLOWING_MODEL_OVERRIDE: Set<Tier> = new Set(['practice', 'enterprise']);

export function resolveProviderAndModel(
  tier: Tier,
  requestedModel: string | undefined,
): { provider: Provider; model: string } {
  const config: RoutingConfig = getRoutingConfig();

  const tierOverride = config.tierOverrides?.[tier];
  const baseProvider: Provider = tierOverride?.provider ?? config.defaultProvider;
  const baseModel: string = tierOverride?.model ?? config.defaultModel;

  if (requestedModel && TIERS_ALLOWING_MODEL_OVERRIDE.has(tier)) {
    // Keep the base provider unless the model string hints at a different one.
    const provider = inferProviderFromModel(requestedModel) ?? baseProvider;
    return { provider, model: requestedModel };
  }

  return { provider: baseProvider, model: baseModel };
}

function inferProviderFromModel(model: string): Provider | null {
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('gemini-')) return 'google';
  return null;
}

export async function dispatchRequest(
  tier: Tier,
  request: ProxyRequest,
): Promise<ProxyResponse> {
  const { provider, model } = resolveProviderAndModel(tier, request.model);
  const apiKey = getProviderKey(provider);

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  const resolvedRequest: ProxyRequest = { ...request, model };

  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiKey, resolvedRequest);
    case 'openai':
      return callOpenAi(apiKey, resolvedRequest);
    case 'google':
      return callGemini(apiKey, resolvedRequest);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
