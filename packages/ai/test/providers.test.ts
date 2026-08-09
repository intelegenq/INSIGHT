import { describe, expect, it, beforeEach, vi } from "vitest";
import { createAIProvider, MockProvider } from "../src/providers/AIGateway";
import { resolveAIProviderConfig } from "../src/types";
import type { AIProvider, AIRequest, AIResponse } from "../src/types";

describe("AI Gateway — provider selection", () => {
  it("createAIProvider returns mock when no config", () => {
    const provider = createAIProvider(resolveAIProviderConfig({}));
    expect(provider.id).toBe("mock");
    expect(provider.available).toBe(true);
  });

  it("createAIProvider returns mock when provider is mock", () => {
    const provider = createAIProvider(resolveAIProviderConfig({ AI_PROVIDER: "mock" }));
    expect(provider.id).toBe("mock");
  });

  it("createAIProvider falls back to mock when no keys", () => {
    const provider = createAIProvider(resolveAIProviderConfig({ AI_PROVIDER: "openrouter" }));
    // No OPENROUTER_API_KEY set — falls back to mock
    expect(provider.id).toBe("mock");
  });

  it("createAIProvider selects openrouter when configured", () => {
    const provider = createAIProvider(
      resolveAIProviderConfig({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_MODEL: "test-model",
      }),
    );
    expect(provider.id).toBe("openrouter");
    expect(provider.available).toBe(true);
  });

  it("createAIProvider selects nvidia-nim when configured", () => {
    const provider = createAIProvider(
      resolveAIProviderConfig({
        AI_PROVIDER: "nvidia-nim",
        NVIDIA_NIM_API_KEY: "test-key",
        NVIDIA_NIM_MODEL: "test-model",
      }),
    );
    expect(provider.id).toBe("nvidia-nim");
    expect(provider.available).toBe(true);
  });

  it("createAIProvider falls back to openrouter when configured provider unavailable", () => {
    const provider = createAIProvider(
      resolveAIProviderConfig({
        AI_PROVIDER: "nvidia-nim",
        OPENROUTER_API_KEY: "fallback-key",
      }),
    );
    // nvidia-nim not configured but openrouter is — falls back to openrouter
    expect(provider.id).toBe("openrouter");
  });
});

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("has correct id and availability", () => {
    expect(provider.id).toBe("mock");
    expect(provider.available).toBe(true);
  });

  it("complete returns a deterministic response with context", async () => {
    const request: AIRequest = {
      systemPrompt: "test system prompt",
      userMessage: "What projects are in Insight?",
      context: '{"projects":[{"id":"p1","name":"Test"}]}',
    };
    const response = await provider.complete(request);
    expect(response.provider).toBe("mock");
    expect(response.text).toContain("Mock AI");
    expect(response.text).toContain("What projects are in Insight?");
  });

  it("complete returns a deterministic response without context", async () => {
    const request: AIRequest = {
      systemPrompt: "test",
      userMessage: "Hello",
    };
    const response = await provider.complete(request);
    expect(response.text).toContain("No Insight context");
  });
});

describe("OpenRouter adapter", () => {
  it("complete calls the OpenRouter API and returns text", async () => {
    const provider = createAIProvider(
      resolveAIProviderConfig({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_MODEL: "test-model",
      }),
    );
    expect(provider.id).toBe("openrouter");

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Test answer from OpenRouter" } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", mockFetch);

    const request: AIRequest = {
      systemPrompt: "test",
      userMessage: "question",
      context: '{"data":"test"}',
    };
    const response = await provider.complete(request);

    expect(response.text).toBe("Test answer from OpenRouter");
    expect(response.provider).toBe("openrouter");
    expect(response.usage?.promptTokens).toBe(100);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");

    // Verify auth header is set (key is in the request, not leaked to client)
    const fetchInit = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");

    vi.unstubAllGlobals();
  });

  it("complete throws on non-ok response", async () => {
    const provider = createAIProvider(
      resolveAIProviderConfig({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "test-key",
      }),
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized: invalid api key sk-xxx"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(provider.complete({ systemPrompt: "t", userMessage: "q" })).rejects.toThrow(
      "AI provider error 401",
    );

    vi.unstubAllGlobals();
  });
});

describe("NVIDIA NIM adapter", () => {
  it("complete calls the NIM API and returns text", async () => {
    const provider = createAIProvider(
      resolveAIProviderConfig({
        AI_PROVIDER: "nvidia-nim",
        NVIDIA_NIM_API_KEY: "nim-key",
        NVIDIA_NIM_MODEL: "nim-model",
        NVIDIA_NIM_BASE_URL: "https://nim.example.com/v1",
      }),
    );
    expect(provider.id).toBe("nvidia-nim");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "NIM answer" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", mockFetch);

    const response = await provider.complete({
      systemPrompt: "s",
      userMessage: "q",
      context: '{"x":1}',
    });

    expect(response.text).toBe("NIM answer");
    expect(response.provider).toBe("nvidia-nim");
    expect(mockFetch.mock.calls[0]?.[0]).toBe("https://nim.example.com/v1/chat/completions");

    vi.unstubAllGlobals();
  });
});
