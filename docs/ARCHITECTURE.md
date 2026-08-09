# Architecture

## Shape

```text
apps/web             Presentation and user interaction
packages/core        Domain entities, scoring, evidence, and report contracts
packages/shared      Small framework-independent helpers
packages/ui          Design tokens and reusable UI components
services/worker      Scheduled collectors, AI orchestration, and API workers
```

## Boundaries

- The web app reads data through typed contracts; it must not directly embed provider-specific fetching logic.
- Core contains domain vocabulary and deterministic transformations; it has no React or framework dependency.
- Collectors normalize raw source material into evidence records.
- AI-generated output is stored and rendered with its evidence, generation metadata, and confidence.

## Initial deployment

- Next.js frontend: Vercel
- API, scheduled collectors, and workers: Docker-compatible service
- Primary store: PostgreSQL
- Cache/queue: Redis
- Artifact storage: S3-compatible object storage

This separates fast product iteration from worker portability.
