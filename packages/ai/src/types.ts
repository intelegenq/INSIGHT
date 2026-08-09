/**
 * AI domain contracts — framework-independent types for the AI assistant.
 *
 * The LLM is ONLY a natural-language interface over Insight's deterministic
 * data. These contracts define the boundary between user questions and the
 * structured Insight context that grounds the AI's answers.
 */

/** A reference to an Insight evidence item, surfaced as a citation. */
export interface Citation {
  /** Evidence ID from Insight's evidence store. */
  evidenceId: string;
  /** Source identifier (e.g. "helius", "coingecko", "demo"). */
  source: string;
  /** Status of the evidence (verified, demo, pending, draft). */
  status: string;
  /** Human-readable note from the evidence record. */
  note: string;
  /** Optional reference URL/tx/artifact pointer. */
  reference?: string;
}

/** A project reference surfaced in the assistant response. */
export interface ProjectReference {
  id: string;
  name: string;
  category: string;
  description: string;
  chain?: string;
}

/** A narrative reference surfaced in the assistant response. */
export interface NarrativeReference {
  id: string;
  name: string;
  trend: string;
  change?: string;
  note: string;
}

/** A report reference surfaced in the assistant response. */
export interface ReportReference {
  id: string;
  title: string;
  lens: string;
  confidence: string;
}

/** A knowledge graph entity reference surfaced in the assistant response. */
export interface GraphEntityReference {
  kind: string;
  id: string;
  name?: string;
}

/** A health score reference surfaced in the assistant response. */
export interface HealthReference {
  projectId: string;
  projectName: string;
  health: number;
  momentum: number;
  risk: number;
  developer: number;
}

/** Structured metadata about the assistant response. */
export interface AssistantMetadata {
  /** Whether the AI provider was used (false = insufficient data fallback). */
  providerUsed: boolean;
  /** Name of the AI provider (e.g. "openrouter", "nvidia-nim", "mock"). */
  providerName: string;
  /** Number of context items sent to the AI. */
  contextSize: number;
  /** Whether Insight had sufficient data to answer. */
  hasSufficientData: boolean;
  /** Timestamp of the response. */
  timestamp: string;
}

/** Structured assistant response returned to the API/UI. */
export interface AssistantResponse {
  /** Natural-language answer from the AI (or a deterministic fallback). */
  answer: string;
  /** Evidence citations referenced in the answer. */
  citations: Citation[];
  /** Relevant projects surfaced in the context. */
  projects: ProjectReference[];
  /** Relevant narratives surfaced in the context. */
  narratives: NarrativeReference[];
  /** Relevant reports surfaced in the context. */
  reports: ReportReference[];
  /** Knowledge graph entities from the context. */
  graphEntities: GraphEntityReference[];
  /** Health scores for relevant projects. */
  healthScores: HealthReference[];
  /** Ecosystem pulse snapshot if available. */
  pulse: {
    totalProjects: number;
    totalNarratives: number;
    totalEvidence: number;
    generatedAt: string;
  } | null;
  /** Number of historical snapshots available. */
  snapshotCount: number;
  /** Response metadata. */
  metadata: AssistantMetadata;
}

/** A request to the AI provider. */
export interface AIRequest {
  /** The system prompt with grounding instructions. */
  systemPrompt: string;
  /** The user's question. */
  userMessage: string;
  /** Bounded structured context as a JSON string (or undefined for no context). */
  context?: string;
  /** Maximum tokens for the response. */
  maxTokens?: number;
  /** Temperature (0 = deterministic, 1 = creative). */
  temperature?: number;
}

/** A response from the AI provider. */
export interface AIResponse {
  /** The generated text. */
  text: string;
  /** Name of the provider that produced this response. */
  provider: string;
  /** Token usage if available. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/**
 * AIProvider — the provider-agnostic abstraction.
 * Implementations: OpenRouter, NVIDIA NIM, MockProvider (tests).
 */
export interface AIProvider {
  /** Unique provider identifier (e.g. "openrouter", "nvidia-nim"). */
  readonly id: string;
  /** Whether the provider is configured and ready to use. */
  readonly available: boolean;
  /** Send a request to the AI provider. */
  complete(request: AIRequest): Promise<AIResponse>;
}

/** Provider configuration resolved from environment. */
export interface AIProviderConfig {
  /** Which provider to use: "openrouter", "nvidia-nim", or "mock". */
  provider: string;
  /** OpenRouter configuration. */
  openrouter?: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  /** NVIDIA NIM configuration. */
  nvidiaNim?: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

/** Resolve AI provider config from environment. */
export function resolveAIProviderConfig(
  env: Record<string, string | undefined> = process.env,
): AIProviderConfig {
  const provider = env["AI_PROVIDER"] ?? "mock";

  const openrouter =
    env["OPENROUTER_API_KEY"] && env["OPENROUTER_API_KEY"].length > 0
      ? {
          apiKey: env["OPENROUTER_API_KEY"],
          baseUrl: env["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1",
          model: env["OPENROUTER_MODEL"] ?? "meta-llama/llama-3.3-70b-instruct:free",
        }
      : undefined;

  const nvidiaNim =
    env["NVIDIA_NIM_API_KEY"] && env["NVIDIA_NIM_API_KEY"].length > 0
      ? {
          apiKey: env["NVIDIA_NIM_API_KEY"],
          baseUrl: env["NVIDIA_NIM_BASE_URL"] ?? "https://integrate.api.nvidia.com/v1",
          model: env["NVIDIA_NIM_MODEL"] ?? "meta/llama-3.1-70b-instruct",
        }
      : undefined;

  return { provider, openrouter, nvidiaNim };
}
