# Insight

**A comprehensive, automatically updating report on the current state of the Solana ecosystem.**

Insight transforms Solana ecosystem data into actionable intelligence through automated reports, AI summaries, and interactive research — with full evidence traceability and minimal API-key dependency.

---

## Mission

**Mission:** Create a comprehensive, automatically updating report on the current state of the Solana ecosystem.

Insight addresses every Mission judging criterion:

| Criterion                                      | How Insight Addresses It                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Comprehensive Solana data collection           | 4 data providers: Solana RPC, Helius, DeFiLlama, CoinGecko + demo fallback                                      |
| Solana RPC/network metrics                     | SolanaRPCProvider calls getEpochInfo, getVoteAccounts, getInflationRate, getClusterNodes, getPerformanceSamples |
| Validator/stake/delinquency/commission metrics | getVoteAccounts returns active/delinquent validators, activatedStake, commission per validator                  |
| Ecosystem/community information                | Narratives, knowledge graph entities, timeline events, project descriptions                                     |
| SOL/TVL/stablecoin/DEX/fee/economic metrics    | CoinGecko (SOL price, market cap, volume), DeFiLlama (TVL, protocol breakdowns), Solana RPC (inflation, TPS)    |
| Ecosystem growth metrics                       | Snapshot comparison, project trend analysis, multi-project overlay, evidence timeline                           |
| Upcoming Solana developments                   | Narrative trend tracking with direction indicators (up/down/flat/watch)                                         |
| Automated refresh                              | Scheduled ingestion worker with configurable interval, POST /api/refresh trigger                                |
| Anomaly detection                              | Alert subscriptions (health_drop, health_rise, trend_change, new_evidence, tvl_change) with trigger history     |
| Interactive HTML dashboard                     | /dashboard, /pulse, /projects, /narratives, /graph, /trends, /evidence, /compare — 20 UI pages                  |
| Markdown report                                | POST /api/reports/export with format:"markdown" — sample at `samples/sample-report.md`                          |
| JSON report                                    | POST /api/reports/export with format:"json" — sample at `samples/sample-report.json`                            |
| Evidence/source traceability                   | Every evidence item has source, status, observedAt, reference — linked to projects, narratives, and reports     |
| Minimal API-key dependency                     | 3 of 4 data sources are public APIs requiring no key; Helius is optional; AI defaults to mock                   |

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

Insight runs in **demo mode** by default — no API keys required. Set `NEXT_PUBLIC_INSIGHT_DATA_MODE=demo` or simply leave all credentials blank. The app uses deterministic demo data that showcases all features:

- Ecosystem pulse with tracked projects, narratives, and evidence
- Cited research briefs with quality verdicts
- Project health scores (health, momentum, risk, developer)
- Knowledge graph with entities and relationships
- AI assistant with mock provider (deterministic, offline)
- All UI pages fully navigable

## Live Data Setup

Copy `apps/web/.env.example` to `.env.local` and fill in credentials:

### Required Credentials

None. All data sources have public/free fallbacks. Credentials are optional.

### Optional Credentials

| Variable             | Required?               | Description                                                                                                                                         |
| -------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOLANA_RPC_URL`     | No (public default)     | Solana RPC endpoint. Defaults to `https://api.mainnet-beta.solana.com` (public, rate-limited). A paid RPC (Helius, QuickNode) improves reliability. |
| `HELIUS_API_KEY`     | No (optional)           | Helius API key for enhanced on-chain data. Without it, the Helius provider is skipped and Solana RPC covers validator/stake/epoch metrics.          |
| `AI_PROVIDER`        | No (defaults to `mock`) | AI provider for the assistant: `openrouter`, `nvidia-nim`, or `mock`.                                                                               |
| `OPENROUTER_API_KEY` | No (optional)           | OpenRouter API key for AI assistant. Without it, the mock provider gives deterministic offline answers.                                             |
| `OPENROUTER_MODEL`   | No (defaults to free)   | OpenRouter model. Defaults to `meta-llama/llama-3.3-70b-instruct:free` — a free model.                                                              |
| `NVIDIA_NIM_API_KEY` | No (optional)           | NVIDIA NIM API key as alternative AI provider.                                                                                                      |

### Infrastructure (Docker Compose only)

| Variable                     | Required?               | Description                                            |
| ---------------------------- | ----------------------- | ------------------------------------------------------ |
| `INSIGHT_POSTGRES_URL`       | No (in-memory fallback) | PostgreSQL connection string for snapshot persistence. |
| `INSIGHT_REDIS_URL`          | No (in-memory fallback) | Redis connection URL for caching.                      |
| `INSIGHT_S3_ENDPOINT`        | No (in-memory fallback) | S3-compatible endpoint for report artifact storage.    |
| `INSIGHT_WORKER_INTERVAL_MS` | No (default 300000)     | Refresh interval in milliseconds (5 min default).      |

### Public APIs (No Key Required)

| Source     | URL                                   | Data                                                                         |
| ---------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| Solana RPC | `https://api.mainnet-beta.solana.com` | Validator/stake/delinquency/commission, epoch, inflation, TPS, cluster nodes |
| DeFiLlama  | `https://api.llama.fi`                | TVL, protocol metadata, chain breakdowns                                     |
| CoinGecko  | `https://api.coingecko.com/api/v3`    | SOL price, market cap, volume, supply                                        |

### Fallback Behavior

When credentials are absent:

- **No `HELIUS_API_KEY`** → Helius provider skipped; Solana RPC still provides validator/stake/epoch metrics
- **No `AI_PROVIDER` / `OPENROUTER_API_KEY`** → Mock provider gives deterministic, offline answers grounded in Insight data
- **No `INSIGHT_POSTGRES_URL`** → In-memory SQL fallback for snapshot persistence (resets on restart)
- **No `INSIGHT_REDIS_URL`** → In-memory cache fallback
- **`NEXT_PUBLIC_INSIGHT_DATA_MODE=demo`** → All live providers skipped; deterministic demo data only

## Data Sources

| Source     | API Key        | Data Collected                                                                                           |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| Solana RPC | No (public)    | Validator/stake/delinquency/commission, epoch info, inflation rate, TPS, cluster nodes, program accounts |
| Helius     | Yes (optional) | On-chain token accounts, program data via enhanced RPC                                                   |
| DeFiLlama  | No (public)    | TVL, protocol metadata, chain breakdowns, 24h/7d/30d changes                                             |
| CoinGecko  | No (public)    | SOL price, market cap, 24h volume, circulating supply, ATH/ATL                                           |
| Demo       | N/A            | Deterministic demo data covering all features                                                            |

## Features

### Automated Reports

- **Ecosystem pulse** — real-time overview of projects, narratives, and evidence
- **Cited research briefs** — Markdown, JSON, and PDF export with evidence citations
- **Quality verdicts** — automated report evaluation with confidence scoring
- **Sample reports** — see `samples/sample-report.md` and `samples/sample-report.json`

### Interactive Dashboard

- **/dashboard** — customizable overview with section toggles and reordering
- **/projects** — project list with health scores, metrics, and detail pages
- **/narratives** — trending themes with direction indicators and detail pages
- **/graph** — knowledge graph entity browser with relationship visualization
- **/trends** — project trend comparison over time with multi-project overlay
- **/evidence** — chronological evidence timeline with status/source filtering
- **/compare** — side-by-side project metrics and health scores
- **/history** — snapshot timeline with diff comparison
- **/health** — source health monitoring with per-provider status
- **/alerts** — alert subscription management
- **/assistant** — AI assistant with conversation history
- **/search** — global search with saved search subscriptions
- **/saved** — saved research dashboard with session management

### AI Assistant

- Natural-language interface over Insight's deterministic data
- Grounded answers with evidence citations — no web search, no invented facts
- Provider-agnostic: OpenRouter (free models), NVIDIA NIM, or mock fallback
- Conversation history with health scores, graph entities, pulse, and snapshots in context
- The AI is ONLY the natural-language interface — Insight data is the source of truth

### Alert System (Anomaly Detection)

- Subscribe to health drops, health rises, trend changes, new evidence, and TVL changes
- Alert trigger history with old/new value tracking
- Active/triggered status badges
- Alerts link to the monitored project or narrative

### Automated Refresh

- Scheduled ingestion worker with configurable interval (`INSIGHT_WORKER_INTERVAL_MS`)
- POST `/api/refresh` — manual trigger for a live data refresh cycle
- Snapshot persistence (Postgres in production, in-memory in dev/test)
- Source health monitoring with per-provider status
- Snapshot diff comparison for change detection

## API Endpoints

| Method          | Path                          | Description                        |
| --------------- | ----------------------------- | ---------------------------------- |
| GET             | `/api/pulse`                  | Ecosystem pulse metrics + timeline |
| GET             | `/api/projects`               | All tracked projects               |
| GET             | `/api/projects/[id]`          | Project detail with health scores  |
| GET             | `/api/narratives`             | All narratives                     |
| GET             | `/api/narratives/[id]`        | Narrative detail with evidence     |
| GET             | `/api/reports?lens=ecosystem` | Report by lens                     |
| POST            | `/api/reports/export`         | Export report (markdown/json/pdf)  |
| GET             | `/api/reports/evaluated`      | Report with quality verdict        |
| GET             | `/api/graph`                  | Knowledge graph overview           |
| GET             | `/api/graph/[id]`             | Entity detail with edges           |
| GET             | `/api/health`                 | Source health status               |
| GET             | `/api/search?q=...`           | Global search                      |
| GET             | `/api/compare?ids=...`        | Cross-project comparison           |
| GET             | `/api/dashboard`              | Aggregated dashboard data          |
| GET             | `/api/trends/projects/[id]`   | Project trend over time            |
| GET             | `/api/trends/overlay?ids=...` | Multi-project trend overlay        |
| GET             | `/api/evidence/timeline`      | Chronological evidence             |
| GET             | `/api/snapshots`              | All snapshots                      |
| GET             | `/api/history?from=&to=`      | Snapshot diff comparison           |
| POST            | `/api/assistant`              | AI assistant (grounded Q&A)        |
| POST            | `/api/refresh`                | Trigger data refresh               |
| GET/POST/DELETE | `/api/saved`                  | Saved research CRUD                |
| GET/PATCH       | `/api/sessions/[id]`          | Research session detail            |
| GET/POST/DELETE | `/api/auth/*`                 | Authentication                     |

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

## Sample Reports

- **Markdown:** `samples/sample-report.md` — ecosystem report with evidence citations
- **JSON:** `samples/sample-report.json` — structured report with evidence and quality verdict

Generate live reports via API:

```bash
# Markdown
curl -X POST http://localhost:3000/api/reports/export \
  -H "Content-Type: application/json" \
  -d '{"lens":"ecosystem","format":"markdown"}'

# JSON
curl -X POST http://localhost:3000/api/reports/export \
  -H "Content-Type: application/json" \
  -d '{"lens":"ecosystem","format":"json"}'
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

- Each evidence item has a `source` (e.g., "Helius", "DeFiLlama", "Solana RPC"), `status` (verified/demo/pending/draft), `observedAt` timestamp, and optional `reference` URL
- Projects and narratives link to their supporting evidence via `evidenceIds`
- Reports include evidence citations in Markdown, JSON, and PDF exports
- The AI assistant cites evidence IDs in its answers
- The evidence timeline page (`/evidence`) shows all evidence chronologically with project/narrative associations

## Limitations

- **Demo mode data is illustrative** — when no live credentials are configured, all metrics, projects, and narratives are deterministic demo data, not real ecosystem data
- **Public Solana RPC is rate-limited** — for production use, a paid RPC endpoint (Helius, QuickNode) is recommended to avoid rate-limit errors
- **AI assistant is a language interface only** — it translates Insight's structured data into natural language; it does not perform independent analysis, browse the web, or access external knowledge
- **No real-time streaming** — data refreshes on a scheduled interval (default 5 minutes), not on every block
- **Snapshot persistence depends on infrastructure** — without Postgres configured, snapshots are in-memory and reset on restart

## Tech Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **Build**: Turborepo, pnpm
- **Testing**: Vitest
- **Styling**: CSS custom properties, responsive design
- **AI**: OpenRouter (free models), NVIDIA NIM, mock provider
- **Storage**: PostgreSQL, Redis, S3/MinIO
- **Deployment**: Vercel, Docker Compose
