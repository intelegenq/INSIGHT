/** @insight/ai — AI assistant domain (M31) */
export type {
  AIProvider,
  AIRequest,
  AIResponse,
  AIProviderConfig,
  AssistantResponse,
  AssistantMetadata,
  Citation,
  ProjectReference,
  NarrativeReference,
  ReportReference,
  GraphEntityReference,
  HealthReference,
} from "./types";
export { resolveAIProviderConfig } from "./types";
export { createAIProvider, MockProvider } from "./providers/AIGateway";
export type {
  InsightDataSource,
  ExtendedInsightDataSource,
  GraphDataSource,
} from "./context/ContextRetriever";
export { ContextRetriever, serializeContext } from "./context/ContextRetriever";
export type {
  InsightContext,
  ContextRetrievalOptions,
  ContextHealthEntry,
  ContextPulse,
  ContextSnapshotSummary,
} from "./context/ContextRetriever";
export { AssistantService } from "./assistant/AssistantService";
export type { AssistantServiceOptions } from "./assistant/AssistantService";
