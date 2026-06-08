import type { AIProvider } from '../types/index.js';
import { GroqProvider } from './groq-provider.js';

// Provider registry — add new providers here (e.g. AnthropicProvider, OpenAIProvider)
// without changing any calling code. Only Groq is implemented as required.
type ProviderName = 'groq';

const providers: Record<ProviderName, () => AIProvider> = {
  groq: () => new GroqProvider(),
};

let activeProvider: AIProvider | null = null;

/**
 * Get the active AI provider. Creates a singleton instance on first call.
 * The default provider is Groq. To switch providers, call setProvider() first.
 */
export function getAIProvider(): AIProvider {
  if (!activeProvider) {
    activeProvider = providers.groq();
  }
  return activeProvider;
}

/**
 * Switch the active provider at runtime.
 * Useful for testing or future multi-provider support.
 */
export function setProvider(name: ProviderName): void {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown AI provider: ${name}`);
  }
  activeProvider = factory();
}

export type { AIProvider };
