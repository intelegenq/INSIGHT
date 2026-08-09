# Architecture

## Shape

```text
apps/web             Presentation and user interaction
packages/core        Domain entities, scoring, evidence, and report contracts
packages/ai          AI assistant domain: provider abstraction, context retrieval, assistant service
packages/shared      Small framework-independent helpers
packages/ui          Design tokens and reusable UI components
services/worker      Scheduled collectors, AI orchestration, and API workers
```

## Boundaries

- The web app reads data through typed contracts; it must not directly embed provider-specific fetching logic.
- Core contains domain vocabulary and deterministic transformations; it has no React or framework dependency.
- Collectors normalize raw source material into evidence records.
- AI-generated output is stored and rendered with its evidence, generation metadata, and confidence.
- The AI assistant is a natural-language interface over Insight's deterministic data — it must not invent facts, browse the web, or create independent intelligence.
- AI provider calls are server-side only; no API keys reach the browser.

## AI assistant boundary (M31)

- User question → Insight data/context retrieval → bounded structured context → AI gateway (OpenRouter/NVIDIA NIM) → natural-language answer + evidence citations.
- The AI gateway is provider-agnostic: OpenRouter is the primary provider, NVIDIA NIM is the fallback, and a deterministic mock provider is used in tests/dev.
- The assistant service refuses or qualifies when Insight lacks sufficient data.
- Context retrieval uses only existing Insight contracts (projects, evidence, narratives, reports, knowledge graph) — no web search or external retrieval.

## Initial deployment

- Next.js frontend: Vercel
- API, scheduled collectors, and workers: Docker-compatible service
- Primary store: PostgreSQL
- Cache/queue: Redis
- Artifact storage: S3-compatible object storage

This separates fast product iteration from worker portability.
