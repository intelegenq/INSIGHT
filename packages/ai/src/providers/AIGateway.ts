/**
 * AI Gateway — provider selection, retry, timeout, and graceful failure.
 *
 * Resolves the configured AI provider (OpenRouter, NVIDIA NIM, or mock).
 * All provider calls are server-side only; no API keys reach the browser.
 * Uses @insight/infra resilience (withTimeout, retry) and security (redactSecrets).
 */
import type { AIProvider, AIProviderConfig, AIRequest, AIResponse } from "../types";
import { resolveAIProviderConfig } from "../types";
import { withTimeout, retry, TimeoutError } from "@insight/infra";
import { redactSecrets } from "@insight/infra";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.3;

/** Resolve provider config from env. */
export function resolveConfig(): AIProviderConfig {
  return resolveAIProviderConfig();
}

/** Create the AI provider based on configuration. */
export function createAIProvider(config?: AIProviderConfig): AIProvider {
  const resolved = config ?? resolveConfig();
  const providerName = resolved.provider;

  // Try the configured provider first
  if (providerName === "openrouter" && resolved.openrouter) {
    return new OpenRouterProvider(resolved.openrouter);
  }
  if (providerName === "nvidia-nim" && resolved.nvidiaNim) {
    return new NvidiaNimProvider(resolved.nvidiaNim);
  }

  // Fallback: try any available provider
  if (resolved.openrouter) return new OpenRouterProvider(resolved.openrouter);
  if (resolved.nvidiaNim) return new NvidiaNimProvider(resolved.nvidiaNim);

  // No provider configured — return mock (deterministic, offline)
  return new MockProvider();
}

interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** OpenRouter adapter — chat completions API. */
class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly available: boolean;

  constructor(private readonly config: OpenRouterConfig) {
    this.available = config.apiKey.length > 0;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const body = {
      model: this.config.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        ...(request.context ? [{ role: "system", content: request.context }] : []),
        { role: "user", content: request.userMessage },
      ],
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    };

    const response = await retry(
      () =>
        withTimeout(
          () =>
            fetch(`${this.config.baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.config.apiKey}`,
                "HTTP-Referer": "https://insight.app",
                "X-Title": "Insight",
              },
              body: JSON.stringify(body),
            }),
          { timeoutMs: DEFAULT_TIMEOUT_MS },
        ),
      { maxAttempts: 2, delayMs: 1000 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${redactSecrets(text)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      text,
      provider: this.id,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    };
  }
}

interface NvidiaNimConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** NVIDIA NIM adapter — OpenAI-compatible chat completions. */
class NvidiaNimProvider implements AIProvider {
  readonly id = "nvidia-nim";
  readonly available: boolean;

  constructor(private readonly config: NvidiaNimConfig) {
    this.available = config.apiKey.length > 0;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const body = {
      model: this.config.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        ...(request.context ? [{ role: "system", content: request.context }] : []),
        { role: "user", content: request.userMessage },
      ],
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    };

    const response = await retry(
      () =>
        withTimeout(
          () =>
            fetch(`${this.config.baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.config.apiKey}`,
              },
              body: JSON.stringify(body),
            }),
          { timeoutMs: DEFAULT_TIMEOUT_MS },
        ),
      { maxAttempts: 2, delayMs: 1000 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`NVIDIA NIM error ${response.status}: ${redactSecrets(text)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      text,
      provider: this.id,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    };
  }
}

/**
 * MockProvider — deterministic, offline AI provider for tests/dev.
 * Returns a simple echo of the question with a canned response.
 */
export class MockProvider implements AIProvider {
  readonly id = "mock";
  readonly available = true;

  async complete(request: AIRequest): Promise<AIResponse> {
    const hasContext = request.context !== undefined && request.context.length > 0;
    const text = hasContext
      ? `[Mock AI] Based on the supplied Insight context, here is a response to "${request.userMessage}". The context contains structured data from Insight's deterministic pipeline. Note: This is a mock response for testing — in production, a real AI provider would generate the answer.`
      : `[Mock AI] No Insight context was provided for "${request.userMessage}". Insight may not have sufficient data for this question. Note: This is a mock response.`;
    return {
      text,
      provider: this.id,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}
