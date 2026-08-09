# Insight

**A comprehensive, automatically updating report on the current state of the Solana ecosystem.**

Insight transforms Solana ecosystem data into actionable intelligence through automated reports, AI summaries, and interactive research — with full evidence traceability and minimal API-key dependency.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run quality checks
pnpm test
pnpm typecheck
pnpm build
pnpm format:check

# Start the web app (demo mode — no API keys needed)
cd apps/web && pnpm dev

# Start the full stack with Docker
docker compose up --build
```

## Demo Mode

Insight runs in **demo mode** by default — no API keys required. Set `NEXT_PUBLIC_INSIGHT_DATA_MODE=demo` or simply leave all credentials blank. The app uses deterministic demo data that showcases all features.

## Live Data Setup

Copy `apps/web/.env.example` to `.env.local` and fill in credentials:

```env
# Solana RPC (public mainnet — no key needed)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Helius API key (optional — enhances on-chain data)
HELIUS_API_KEY=

# DeFiLlama (public, no key required)
DEFILLAMA_API_URL=https://api.llama.fi

# CoinGecko (public, no key required)
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# AI Assistant (optional — defaults to mock provider)
AI_PROVIDER=mock
OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

## Data Sources

| Source     | API Key        | Data Collected                                                                    |
| ---------- | -------------- | --------------------------------------------------------------------------------- |
| Solana RPC | No (public)    | Validator/stake/delinquency/commission, epoch info, inflation, TPS, cluster nodes |
| Helius     | Yes (optional) | On-chain token accounts, program data                                             |
| DeFiLlama  | No (public)    | TVL, protocol metadata, chain breakdowns                                          |
| CoinGecko  | No (public)    | SOL price, market cap, volume, supply                                             |
| Demo       | N/A            | Deterministic demo data for all features                                          |

## Features

### Automated Reports

- **Ecosystem pulse** — real-time overview of projects, narratives, and evidence
- **Cited research briefs** — Markdown, JSON, and PDF export with evidence citations
- **Quality verdicts** — automated report evaluation with confidence scoring

### Interactive Dashboard

- **Project intelligence** — health scores, metrics, evidence per project
- **Narratives** — trending themes with direction indicators
- **Knowledge graph** — entity browser with relationship visualization
- **Trends** — project trend comparison over time with multi-project overlay
- **Evidence timeline** — chronological evidence with status/source filtering
- **Cross-entity comparison** — side-by-side project metrics and health scores

### Alert System

- Subscribe to health drops, trend changes, TVL changes, and new evidence
- Alert trigger history with old/new value tracking
- Active/triggered status badges

### AI Assistant

- Natural-language interface over Insight's deterministic data
- Grounded answers with evidence citations
- Provider-agnostic: OpenRouter (free models), NVIDIA NIM, or mock fallback
- Conversation history with health scores, graph entities, and pulse data

### Automated Refresh

- Scheduled ingestion worker with configurable interval
- Snapshot persistence (Postgres or in-memory fallback)
- Source health monitoring with per-provider status
- Snapshot diff comparison for change detection

## Architecture

```
apps/web             Next.js presentation layer + API routes
packages/core        Domain entities, scoring, evidence, report contracts
packages/ai          AI assistant: provider abstraction, context retrieval
packages/data        Data providers, normalization, evidence collection
packages/infra       Infrastructure: Postgres, Redis, S3, observability
packages/intelligence  Health scoring engine
packages/knowledge   Knowledge graph builder
packages/runtime     Refresh engine, snapshot pipeline
services/worker      Scheduled ingestion worker
```

## Deployment

### Vercel (web app)

The web app deploys to Vercel with zero config — `vercel.json` is included.

### Docker (full stack)

```bash
docker compose up --build
```

Brings up: Postgres, Redis, MinIO (S3), web app, and ingestion worker.

## Development

```bash
pnpm test          # Run all tests (9 packages)
pnpm typecheck     # TypeScript type checking
pnpm build         # Production build
pnpm format        # Format code with Prettier
pnpm format:check  # Check formatting without writing
```

## Evidence Traceability

Every claim in Insight is backed by evidence:

- Each evidence item has a `source` (e.g., "Helius", "DeFiLlama"), `status` (verified/demo/pending/draft), `observedAt` timestamp, and optional `reference` URL
- Projects and narratives link to their supporting evidence via `evidenceIds`
- Reports include evidence citations in Markdown, JSON, and PDF exports
- The AI assistant cites evidence IDs in its answers

## Tech Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **Build**: Turborepo, pnpm
- **Testing**: Vitest
- **Styling**: CSS custom properties, responsive design
- **AI**: OpenRouter (free models), NVIDIA NIM, mock provider
- **Storage**: PostgreSQL, Redis, S3/MinIO
- **Deployment**: Vercel, Docker Compose
