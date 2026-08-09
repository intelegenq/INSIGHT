import { describe, expect, it, beforeEach } from "vitest";
import { resolveAIProviderConfig, type AIProviderConfig } from "../src/types";

describe("AI domain contracts", () => {
  it("resolveAIProviderConfig defaults to mock provider", () => {
    const config = resolveAIProviderConfig({});
    expect(config.provider).toBe("mock");
    expect(config.openrouter).toBeUndefined();
    expect(config.nvidiaNim).toBeUndefined();
  });

  it("resolveAIProviderConfig reads OpenRouter config from env", () => {
    const config = resolveAIProviderConfig({
      AI_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "test-key",
      OPENROUTER_BASE_URL: "https://custom.openrouter.ai/api/v1",
      OPENROUTER_MODEL: "anthropic/claude-4-opus",
    });
    expect(config.provider).toBe("openrouter");
    expect(config.openrouter).toBeDefined();
    expect(config.openrouter!.apiKey).toBe("test-key");
    expect(config.openrouter!.baseUrl).toBe("https://custom.openrouter.ai/api/v1");
    expect(config.openrouter!.model).toBe("anthropic/claude-4-opus");
  });

  it("resolveAIProviderConfig reads NVIDIA NIM config from env", () => {
    const config = resolveAIProviderConfig({
      AI_PROVIDER: "nvidia-nim",
      NVIDIA_NIM_API_KEY: "nim-key",
      NVIDIA_NIM_BASE_URL: "https://nim.example.com/v1",
      NVIDIA_NIM_MODEL: "meta/llama-3.1-405b",
    });
    expect(config.provider).toBe("nvidia-nim");
    expect(config.nvidiaNim).toBeDefined();
    expect(config.nvidiaNim!.apiKey).toBe("nim-key");
    expect(config.nvidiaNim!.baseUrl).toBe("https://nim.example.com/v1");
    expect(config.nvidiaNim!.model).toBe("meta/llama-3.1-405b");
  });

  it("resolveAIProviderConfig uses safe defaults for OpenRouter", () => {
    const config = resolveAIProviderConfig({
      OPENROUTER_API_KEY: "key",
    });
    expect(config.openrouter).toBeDefined();
    expect(config.openrouter!.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(config.openrouter!.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });

  it("resolveAIProviderConfig uses safe defaults for NVIDIA NIM", () => {
    const config = resolveAIProviderConfig({
      NVIDIA_NIM_API_KEY: "key",
    });
    expect(config.nvidiaNim).toBeDefined();
    expect(config.nvidiaNim!.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
    expect(config.nvidiaNim!.model).toBe("meta/llama-3.1-70b-instruct");
  });
});
