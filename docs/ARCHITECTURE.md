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

## Analyst workflow boundary (M32)

- Auth UI: login and register pages with session cookies, wiring existing M25 auth API routes.
- Saved research dashboard: consumed existing M25 /api/saved CRUD routes for reports, narratives, projects, and sessions.
- Snapshot history: consumed existing /api/snapshots and /api/history routes for timeline and diff visualization.
- All analyst workflow pages are client-side React, consistent with existing UI design.

## Report export boundary (M33)

- POST /api/reports/export generates shareable markdown or JSON exports with evidence citations.
- GET /api/reports/evaluated exposes the M30 evaluation verdict (quality, evidence stats, verified flag).
- GET /api/reports/[id]/artifact retrieves persisted report artifacts from ObjectStore.
- Reports page includes export (MD/JSON) and save buttons wired to existing API routes.

## Knowledge graph surfacing boundary (M34)

- GET /api/graph returns the full knowledge graph: entity/relationship summaries and serialized entities/relationships.
- GET /api/graph/[id] resolves a single entity with its outbound and inbound edges and connected entities.
- The /graph page provides an interactive entity browser with kind filtering and a detail panel showing neighborhood connections.
- The AI assistant route now wires GraphDataSource so the AI context includes knowledge graph entities and relationship counts.
- The knowledge graph cache key is invalidated on new snapshots, ensuring stale graph data is never served.

## Source health monitoring boundary (M35)

- GET /api/health returns the health status of all configured data providers using the existing SourceHealthMonitor from @insight/data.
- The /health page displays overall status (healthy/degraded/unavailable), per-provider cards with availability and notes, and a re-check button.
- InsightService.checkSourceHealth() wires the existing checkSourceHealth function over the service's provider array — no new data sources, no duplicated monitoring.

## Narrative detail boundary (M36)

- GET /api/narratives/[id] returns a single narrative with its linked projects and resolved evidence records.
- The /narratives/[id] page displays the narrative's trend, change, linked project cards (clickable to /projects/[id]), and supporting evidence log.
- Narrative cards on /narratives are now clickable links to the detail page, completing the browse → drill-down loop described in PROJECT_MASTER.

## Project health scores boundary (M37)

- GET /api/projects/[id] now includes a `health` field with health, momentum, risk, and developer scores from @insight/intelligence's scoreProject.
- The /projects/[id] page displays a health profile section with four bounded score cards (health 0–100, momentum −100 to +100, risk 0–100, developer 0–100).
- InsightService.getProjectHealth() wires the existing scoreProject function over the service's project and resolved evidence — no new scoring logic.

## Initial deployment

- Next.js frontend: Vercel
- API, scheduled collectors, and workers: Docker-compatible service
- Primary store: PostgreSQL
- Cache/queue: Redis
- Artifact storage: S3-compatible object storage

This separates fast product iteration from worker portability.
