# Insight

**A comprehensive, automatically updating report on the current state of the Solana ecosystem.**

Insight collects Solana network, validator, DeFi, and market data from multiple sources, normalizes it into traceable evidence, generates snapshots on a configurable schedule, and presents it through an interactive dashboard, machine-readable reports, and a grounded AI assistant.

The data pipeline is the source of truth. The AI assistant is only a natural-language interface over data Insight has already collected and analyzed — it does not invent facts or browse the web.

---

## Mission

Insight was built specifically for the **Solana ecosystem reporting Mission**:

> "Create a comprehensive, automatically updating report on the current state of the Solana ecosystem."

### How Insight satisfies each Mission requirement

| Requirement                       | Implementation                                                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Comprehensive data collection** | Solana RPC (epoch, validators, stake, TPS, inflation, cluster nodes), DeFiLlama (Solana-filtered TVL), CoinGecko (SOL price/market cap/volume), Helius (optional on-chain), Demo fallback                                                                  |
| **Automatic refresh**             | Scheduled ingestion worker (`services/worker`) with configurable interval, `RefreshEngine` → snapshot persistence, manual `POST /api/refresh` trigger                                                                                                      |
| **Anomaly detection**             | `AnomalyDetector` engine: TVL drops/rises (≥10%), volume surges (≥25%), validator delinquency spikes (≥50%), TPS anomalies (≥30%), SOL price moves (≥5%), narrative trend shifts. `GET /api/anomalies` endpoint. Alert subscriptions with trigger history. |
| **Evidence / traceability**       | Every data point is an `Evidence` record with `source`, `status`, `observedAt`, and `reference`. Projects and narratives link to evidence via `evidenceIds`. Reports include evidence citations. Evidence timeline page at `/evidence`.                    |
| **Interactive HTML dashboard**    | 20 Next.js pages: `/dashboard`, `/pulse`, `/projects`, `/narratives`, `/graph`, `/trends`, `/evidence`, `/compare`, `/history`, `/health`, `/alerts`, `/assistant`, `/search`, `/saved`, `/reports`, `/login`, `/register`                                 |
| **Markdown report**               | `POST /api/reports/export` with `format: "markdown"`. Sample at `samples/sample-report.md`                                                                                                                                                                 |
| **JSON report**                   | `POST /api/reports/export` with `format: "json"`. Sample at `samples/sample-report.json`                                                                                                                                                                   |
| **PDF report**                    | `POST /api/reports/export` with `format: "pdf"` (printable HTML with inline CSS, auto-print)                                                                                                                                                               |
| **AI natural-language interface** | `POST /api/assistant` + `/assistant` UI page. Grounded in Insight data only. Configurable LLM backend with deterministic offline fallback.                                                                                                                 |

---

## Architecture

```
Data Sources (Solana RPC, Helius, DeFiLlama, CoinGecko, Demo)
    │
    ▼
Providers / Collectors (packages/data/src/providers/)
    │  RawProject, RawEvidence, RawNarrative
    ▼
Normalization (packages/data/src/transformers/)
    │  Project, Evidence, Narrative (core types)
    ▼
Evidence Store → Snapshots (packages/runtime/src/snapshot/)
    │  Immutable, timestamped, content-hashed
    ▼
Intelligence (packages/intelligence/)
    │  Health scores, narratives, signals, anomaly detection
    ▼
Reports / Dashboard (apps/web/)
    │  Next.js API routes + React UI
    ▼
AI Assistant (packages/ai/)
    │  Bounded context from Insight data → AI provider → grounded answer
```

**The AI is NOT the source of truth.** It receives bounded structured context from Insight's collected data and translates it into natural language. It does not independently retrieve Solana facts, browse the web, or create independent intelligence.

---

## Data Sources

### Sources that work without credentials

| Source         | Endpoint                                         | Data Collected                                                                                                                                                                                             | Key Needed                |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Solana RPC** | `https://api.mainnet-beta.solana.com`            | Epoch info, slot index, block height, transaction count, active/delinquent validators, activated stake, commission %, inflation rate, cluster node count, TPS (from performance samples), program accounts | No (public, rate-limited) |
| **DeFiLlama**  | `https://api.llama.fi/protocols`                 | Solana-chain TVL per protocol, 24h/7d/30d changes, protocol category, chain breakdowns                                                                                                                     | No (public)               |
| **CoinGecko**  | `https://api.coingecko.com/api/v3/coins/markets` | SOL price, market cap, 24h volume, circulating supply, 24h price change, ATH/ATL                                                                                                                           | No (public, rate-limited) |
| **Demo**       | N/A                                              | Deterministic illustrative data covering all features                                                                                                                                                      | N/A                       |

### Sources requiring credentials (optional)

| Source                      | Variable             | Data Collected                                         | Behavior if Absent                                                           |
| --------------------------- | -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Helius**                  | `HELIUS_API_KEY`     | On-chain token accounts, program data via enhanced RPC | Helius provider skipped; Solana RPC still provides validator/epoch metrics   |
| **LLM backend**             | `OPENROUTER_API_KEY` | AI assistant natural-language answers                  | Deterministic offline mock provider gives grounded answers from Insight data |
| **Alternative LLM backend** | `NVIDIA_NIM_API_KEY` | Alternative AI provider                                | Skipped; falls back to primary LLM backend or mock                           |

### Fallback behavior

When credentials are absent, Insight degrades gracefully:

- **No `HELIUS_API_KEY`** → Solana RPC still covers validators/stake/epoch/TPS/inflation
- **No `AI_PROVIDER` / `OPENROUTER_API_KEY`** → Deterministic offline mock provider gives grounded answers from Insight data
- **No `INSIGHT_POSTGRES_URL`** → In-memory SQL fallback (snapshots reset on restart)
- **No `INSIGHT_REDIS_URL`** → In-memory cache fallback
- **`NEXT_PUBLIC_INSIGHT_DATA_MODE=demo`** → All live providers skipped; deterministic demo data only

---

## Requirements

- **Node.js**: 22.x (specified in `package.json` engines, Docker uses `node:22-alpine`)
- **pnpm**: 10.14.0 (specified in `package.json` `packageManager`)
- **Docker**: Optional, for full-stack production deployment (Docker Compose v3.9)

---

## Quick Start

### Development (demo mode — no API keys needed)

```bash
git clone https://github.com/qwertyIQ/Insight.git
cd Insight
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @insight/web dev
```

Open `http://localhost:3000` — the dashboard loads with deterministic demo data.

### Verify quality checks

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm format:check
```

### Trigger a manual refresh

```bash
curl -X POST http://localhost:3000/api/refresh
```

This executes the InsightService pipeline and produces a fresh snapshot.

### Use the AI assistant

Open `http://localhost:3000/assistant` and ask a question. In demo mode (default), the mock provider gives deterministic answers grounded in Insight's demo data.

### Generate a report

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

Sample reports are in `samples/sample-report.md` and `samples/sample-report.json`.

---

## Environment Variables

All variables are read from `process.env`. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in as needed. **No variables are required** — Insight runs in demo mode by default.

### Data Sources

| Variable                        | Required | Default                               | Purpose                                                    |
| ------------------------------- | -------- | ------------------------------------- | ---------------------------------------------------------- |
| `SOLANA_RPC_URL`                | No       | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint for validator/epoch/TPS/inflation data |
| `HELIUS_API_KEY`                | No       | (empty)                               | Helius API key for enhanced on-chain data                  |
| `DEFILLAMA_API_URL`             | No       | `https://api.llama.fi`                | DeFiLlama API base URL (public, no key)                    |
| `COINGECKO_API_URL`             | No       | `https://api.coingecko.com/api/v3`    | CoinGecko API base URL (public, no key)                    |
| `NEXT_PUBLIC_INSIGHT_DATA_MODE` | No       | (empty)                               | Set to `demo` to force demo-only data                      |

### Infrastructure (Docker Compose)

| Variable               | Required | Default             | Purpose                                               |
| ---------------------- | -------- | ------------------- | ----------------------------------------------------- |
| `INSIGHT_POSTGRES_URL` | No       | (empty → in-memory) | PostgreSQL connection string for snapshot persistence |
| `INSIGHT_REDIS_URL`    | No       | (empty → in-memory) | Redis connection URL for caching                      |
| `INSIGHT_S3_ENDPOINT`  | No       | (empty → in-memory) | S3-compatible endpoint for report artifacts           |
| `INSIGHT_S3_BUCKET`    | No       | `insight-artifacts` | S3 bucket name                                        |
| `INSIGHT_S3_REGION`    | No       | `us-east-1`         | S3 region                                             |

### Worker

| Variable                      | Required | Default          | Purpose                                      |
| ----------------------------- | -------- | ---------------- | -------------------------------------------- |
| `INSIGHT_WORKER_INTERVAL_MS`  | No       | `300000` (5 min) | Refresh interval in milliseconds             |
| `INSIGHT_WORKER_MAX_FAILURES` | No       | `10`             | Max consecutive failures before worker stops |

### AI Assistant

| Variable              | Required | Default                                  | Purpose                                                      |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------ |
| `AI_PROVIDER`         | No       | `mock`                                   | LLM backend selection: `openrouter`, `nvidia-nim`, or `mock` |
| `OPENROUTER_API_KEY`  | No       | (empty)                                  | API key for primary LLM backend                              |
| `OPENROUTER_BASE_URL` | No       | `https://openrouter.ai/api/v1`           | Primary LLM backend API URL                                  |
| `OPENROUTER_MODEL`    | No       | `meta-llama/llama-3.3-70b-instruct:free` | Primary LLM backend model                                    |
| `NVIDIA_NIM_API_KEY`  | No       | (empty)                                  | API key for alternative LLM backend                          |
| `NVIDIA_NIM_BASE_URL` | No       | `https://integrate.api.nvidia.com/v1`    | Alternative LLM backend API URL                              |
| `NVIDIA_NIM_MODEL`    | No       | `meta/llama-3.1-70b-instruct`            | Alternative LLM backend model                                |

---

## Docker / Production

The `docker-compose.yml` defines a 5-service stack:

| Service    | Image                                                    | Port       | Purpose                               |
| ---------- | -------------------------------------------------------- | ---------- | ------------------------------------- |
| `postgres` | `postgres:16-alpine`                                     | 5432       | Snapshot persistence, entity storage  |
| `redis`    | `redis:7-alpine`                                         | 6379       | Cache, queue                          |
| `minio`    | `minio/minio:latest`                                     | 9000, 9001 | S3-compatible report artifact storage |
| `web`      | Built from `docker/Dockerfile` (target: `web-runner`)    | 3000       | Next.js dashboard + API               |
| `worker`   | Built from `docker/Dockerfile` (target: `worker-runner`) | —          | Scheduled ingestion worker            |

### Commands

```bash
# Build and start the full stack
docker compose up --build

# Start in background
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f web
docker compose logs -f worker

# Rebuild after code changes
docker compose up --build --force-recreate
```

The worker automatically refreshes data every 5 minutes (configurable via `INSIGHT_WORKER_INTERVAL_MS`). Snapshots persist to PostgreSQL so the web app serves the latest data across restarts.

Supply live credentials via `.env` in the project root (Docker Compose reads it automatically):

```env
HELIUS_API_KEY=your_key_here
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_key
OPENROUTER_API_KEY=your_key_here
```

---

## Running Live Data

To activate real Solana data:

1. Copy `apps/web/.env.example` to `apps/web/.env.local`
2. Set `SOLANA_RPC_URL` to a Solana RPC endpoint (public mainnet works, paid RPC recommended for production)
3. Optionally set `HELIUS_API_KEY` for enhanced on-chain data
4. Leave `NEXT_PUBLIC_INSIGHT_DATA_MODE` empty (or remove it) to enable live providers
5. Restart the app

When credentials are absent, Insight falls back to demo data. DeFiLlama and CoinGecko work without keys (public APIs). Solana RPC works with the public endpoint but is rate-limited.

---

## Dashboard

The dashboard is a Next.js web app with 20 pages:

| Route              | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `/`                | Ecosystem pulse — overview with metrics, top projects, narratives, timeline |
| `/dashboard`       | Customizable dashboard with toggleable/reorderable sections                 |
| `/projects`        | Project list with health scores, metrics, evidence                          |
| `/projects/[id]`   | Project detail — health profile, metrics, evidence log                      |
| `/narratives`      | Narrative list with trend direction indicators                              |
| `/narratives/[id]` | Narrative detail — linked projects, evidence                                |
| `/reports`         | Research briefs with export (Markdown/JSON/PDF) and save buttons            |
| `/assistant`       | AI assistant with conversation history                                      |
| `/graph`           | Knowledge graph entity browser with relationship visualization              |
| `/trends`          | Project trend comparison over time + multi-project overlay                  |
| `/evidence`        | Chronological evidence timeline with status/source filtering                |
| `/compare`         | Side-by-side project metrics and health scores                              |
| `/history`         | Snapshot timeline with diff comparison                                      |
| `/health`          | Source health monitoring — per-provider status                              |
| `/alerts`          | Alert subscriptions — create, view trigger history                          |
| `/search`          | Global search with saved search subscriptions                               |
| `/saved`           | Saved research — reports, narratives, projects, sessions, searches          |
| `/saved/[id]`      | Research session detail with add/remove items                               |
| `/login`           | User login                                                                  |
| `/register`        | User registration                                                           |

---

## AI Assistant

**Access:** `http://localhost:3000/assistant`

**What it answers:**

- Project health scores and comparisons
- Ecosystem pulse and overview
- Narrative trends and shifts
- Evidence/source explanations
- Knowledge graph relationships
- Report contents and quality verdicts
- Snapshot history and changes

**Grounding rules:**

- The AI receives bounded structured context from Insight's collected data (projects, evidence, narratives, reports, health scores, pulse, snapshots, graph entities)
- The system prompt enforces: "Use ONLY the supplied Insight context. Do NOT invent facts."
- If Insight lacks sufficient data, the assistant says so explicitly
- Answers include citations referencing evidence IDs
- The AI does not browse the web, access external knowledge, or independently retrieve Solana facts

**Configuration:**

- Default: `mock` (deterministic, offline, no API key needed)
- Live LLM backend: set `AI_PROVIDER` and the corresponding API key in environment variables
- If the AI provider fails, a deterministic fallback answer is generated from Insight's structured data
- Provider-specific implementation details are internal — the assistant UI shows "connected" or "offline" status only

---

## Reports & Exports

### Report lenses

| Lens             | Description                   |
| ---------------- | ----------------------------- |
| `ecosystem`      | Full ecosystem overview       |
| `defi`           | DeFi-focused report           |
| `infrastructure` | Infrastructure-focused report |

### Export formats

| Format       | Method                                               | Description                                                      |
| ------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| **Markdown** | `POST /api/reports/export` with `format: "markdown"` | Human-readable report with evidence citations                    |
| **JSON**     | `POST /api/reports/export` with `format: "json"`     | Machine-readable structured report with evidence                 |
| **PDF**      | `POST /api/reports/export` with `format: "pdf"`      | Self-contained printable HTML with inline CSS, auto-print dialog |

### Sample reports

- `samples/sample-report.md` — Markdown ecosystem report with evidence log
- `samples/sample-report.json` — JSON report with evidence and quality verdict

### Quality verdicts

`GET /api/reports/evaluated` returns the report with a `ReportVerdict` including quality label, evidence statistics, and verified flag.

---

## Automation

### RefreshEngine

The `RefreshEngine` (`packages/runtime`) orchestrates the data pipeline:

1. Calls all registered providers (`fetchProjects`, `fetchEvidence`, `fetchNarratives`)
2. Transforms raw data to core types via the transformer layer
3. Merges and deduplicates across providers
4. Runs intelligence engines (health scoring, narrative derivation, report generation)
5. Produces a `RuntimeResult`
6. Snapshots the result for persistence

### Worker

The ingestion worker (`services/worker`) wraps the RefreshEngine in a `WorkerRunner` loop:

- Runs on a configurable interval (`INSIGHT_WORKER_INTERVAL_MS`, default 5 minutes)
- Persists snapshots to PostgreSQL (or in-memory fallback)
- Shuts down gracefully on SIGTERM/SIGINT
- Logs per-iteration status

### Manual refresh

```bash
curl -X POST http://localhost:3000/api/refresh
```

Returns the new snapshot ID and data.

---

## Anomaly Detection

The `AnomalyDetector` (`packages/intelligence/src/anomalyDetector.ts`) detects ecosystem anomalies by comparing snapshots and evidence:

### Anomaly types

| Type                          | Trigger                             | Default threshold |
| ----------------------------- | ----------------------------------- | ----------------- |
| `tvl_drop`                    | TVL decrease between snapshots      | ≥10%              |
| `tvl_rise`                    | TVL increase between snapshots      | ≥10%              |
| `volume_drop`                 | 24h volume decrease                 | ≥25%              |
| `volume_rise`                 | 24h volume increase                 | ≥25%              |
| `trend_shift`                 | Narrative trend direction change    | Any shift         |
| `validator_delinquency_spike` | Delinquent validator count increase | ≥50%              |
| `tps_anomaly`                 | TPS increase or decrease            | ≥30%              |
| `price_move`                  | SOL price change                    | ≥5%               |
| `new_evidence`                | New projects appearing in snapshot  | Any addition      |

### API

```bash
curl http://localhost:3000/api/anomalies
```

Returns anomalies sorted by severity (1=low, 2=medium, 3=high), comparing the two most recent snapshots.

### Alert subscriptions

Users can subscribe to alerts at `/alerts` with conditions:

- `health_drop` — health score drops below threshold
- `health_rise` — health score rises above threshold
- `trend_change` — narrative trend changes
- `new_evidence` — new evidence added
- `tvl_change` — TVL changes by percentage

Alerts record trigger history with old/new values.

---

## Evidence & Traceability

Every claim in Insight is backed by evidence:

- Each `Evidence` record has: `id`, `source` (id + name), `note`, `status` (verified/demo/pending/draft), `observedAt` (ISO timestamp), `reference` (URL/tx/artifact), `chain`
- Projects link to evidence via `evidenceIds`
- Narratives link to evidence via `evidenceIds`
- Reports include evidence citations in all export formats
- The AI assistant cites evidence IDs in answers
- The `/evidence` page shows all evidence chronologically with project/narrative associations and filtering by status/source

### Evidence sources

| Source     | Evidence produced                                                                 |
| ---------- | --------------------------------------------------------------------------------- |
| Solana RPC | Epoch info, validator counts/stake/commission, inflation rate, TPS, cluster nodes |
| DeFiLlama  | Per-protocol TVL with 24h/7d/30d changes, reference URL to DeFiLlama              |
| CoinGecko  | SOL price, market cap, 24h volume, circulating supply, price change               |
| Demo       | Illustrative lending, developer activity, ecosystem monitoring evidence           |

---

## API

Key API endpoints (all under `/api/`):

| Method            | Path                          | Description                        |
| ----------------- | ----------------------------- | ---------------------------------- |
| `GET`             | `/api/pulse`                  | Ecosystem pulse metrics + timeline |
| `GET`             | `/api/projects`               | All tracked projects               |
| `GET`             | `/api/projects/[id]`          | Project detail with health scores  |
| `GET`             | `/api/narratives`             | All narratives                     |
| `GET`             | `/api/narratives/[id]`        | Narrative detail with evidence     |
| `GET`             | `/api/reports?lens=ecosystem` | Report by lens                     |
| `POST`            | `/api/reports/export`         | Export report (markdown/json/pdf)  |
| `GET`             | `/api/reports/evaluated`      | Report with quality verdict        |
| `GET`             | `/api/graph`                  | Knowledge graph overview           |
| `GET`             | `/api/graph/[id]`             | Entity detail with relationships   |
| `GET`             | `/api/health`                 | Source health status               |
| `GET`             | `/api/anomalies`              | Detected ecosystem anomalies       |
| `GET`             | `/api/search?q=...`           | Global search                      |
| `GET`             | `/api/compare?ids=...`        | Cross-project comparison           |
| `GET`             | `/api/dashboard`              | Aggregated dashboard data          |
| `GET`             | `/api/trends/projects/[id]`   | Project trend over time            |
| `GET`             | `/api/trends/overlay?ids=...` | Multi-project trend overlay        |
| `GET`             | `/api/evidence/timeline`      | Chronological evidence             |
| `GET`             | `/api/snapshots`              | All snapshots                      |
| `GET`             | `/api/history?from=&to=`      | Snapshot diff comparison           |
| `POST`            | `/api/assistant`              | AI assistant (grounded Q&A)        |
| `POST`            | `/api/refresh`                | Trigger data refresh               |
| `GET/POST/DELETE` | `/api/saved`                  | Saved research CRUD                |
| `GET/PATCH`       | `/api/sessions/[id]`          | Research session detail            |
| `POST`            | `/api/auth/register`          | Register user                      |
| `POST`            | `/api/auth/login`             | Login                              |
| `POST`            | `/api/auth/logout`            | Logout                             |
| `GET`             | `/api/auth/me`                | Current user                       |

---

## Development

```bash
pnpm test          # Run all tests (9 packages)
pnpm typecheck     # TypeScript type checking (tsc --noEmit)
pnpm build         # Production build (Next.js + all packages)
pnpm format        # Format code with Prettier
pnpm format:check  # Check formatting without writing
pnpm lint          # ESLint
```

Individual package:

```bash
pnpm --filter @insight/web dev      # Start dev server
pnpm --filter @insight/web test     # Run web tests only
pnpm --filter @insight/data test    # Run data tests only
```

CI runs on every push to `main` and every PR (`.github/workflows/ci.yml`): format check → lint → typecheck → test → determinism guard → build.

---

## Project Structure

```
Insight/
├── apps/
│   └── web/                    # Next.js 15 web app (dashboard, API routes, UI)
├── packages/
│   ├── core/                   # Domain entities, types, scoring contracts
│   ├── ai/                     # AI assistant: provider abstraction, context retrieval
│   ├── data/                   # Data providers, normalization, evidence collection
│   ├── infra/                  # Infrastructure: Postgres, Redis, S3, observability, security
│   ├── intelligence/           # Health scoring, narrative derivation, anomaly detection
│   ├── knowledge/              # Knowledge graph builder
│   └── runtime/                # Refresh engine, snapshot pipeline, history analysis
├── services/
│   └── worker/                 # Scheduled ingestion worker
├── docker/
│   └── Dockerfile              # Multi-target Dockerfile (web + worker)
├── docs/                       # Architecture, roadmap, decisions, guidelines
├── samples/                    # Sample Markdown and JSON reports
├── docker-compose.yml          # Full-stack deployment (Postgres, Redis, MinIO, web, worker)
├── vercel.json                 # Vercel deployment config
├── .github/workflows/ci.yml    # CI pipeline
└── .env.example                # Environment variable template
```

---

## Security / Secrets

- All credentials belong in environment variables or secrets — never in code or committed files
- `.gitignore` excludes `.env`, `.env.*` (except `.env.example`)
- No real API keys, tokens, or passwords are committed to the repository
- The AI provider abstraction redacts secrets in error messages (`redactSecrets` from `@insight/infra`)
- Auth passwords are salted and hashed (`AuthenticationService` in `@insight/data`)
- Session tokens are random and time-limited
- API keys are server-side only — no keys reach the browser

---

## Mission Judging Criteria

### Comprehensiveness

Insight covers:

- **Network performance**: TPS (from `getPerformanceSamples`), slot time, block height, epoch progress (`getEpochInfo`)
- **Validator status**: active/delinquent validators, stake distribution, average commission (`getVoteAccounts`)
- **Economic metrics**: SOL price, market cap, 24h volume (CoinGecko); TVL per protocol (DeFiLlama); inflation rate (`getInflationRate`)
- **Ecosystem growth**: TVL changes, project additions/removals, narrative trends
- **Upcoming developments**: Narrative tracking with direction indicators (up/down/flat/watch)
- **Other indicators**: Cluster node count, transaction count, circulating supply, ATH/ATL

### Automation & Maintainability

- Scheduled ingestion worker with configurable interval
- `RefreshEngine` orchestrates all providers → normalization → intelligence → snapshot
- Snapshots are immutable, content-hashed, and persist to PostgreSQL
- Monorepo with clear package boundaries (core, data, infra, intelligence, runtime, ai, knowledge)
- 9 packages with full test coverage (typecheck + vitest)
- CI pipeline: format → lint → typecheck → test → determinism guard → build

### Clarity & Presentation

- 20-page interactive dashboard with responsive design
- Health scores (0–100) with momentum, risk, and developer sub-scores
- Color-coded trend badges, sparkline charts, evidence timeline
- Customizable dashboard with section toggles and reordering
- Global search with saved search subscriptions
- AI assistant with conversation history and clickable entity links

### Innovation

- Anomaly detection engine detecting TVL/volume/TPS/validator/price anomalies from snapshot diffs
- Alert subscription system with trigger history
- Evidence timeline with project/narrative associations
- Multi-project trend overlay with SVG charts
- Knowledge graph surfacing with entity browser
- AI assistant grounded exclusively in Insight's deterministic data (not model knowledge)

### Technical Implementation

- **Public GitHub repository**: `https://github.com/qwertyIQ/Insight`
- **Reproducible setup**: `pnpm install` → `pnpm dev` (demo mode, no keys)
- **Clear README**: This document
- **Maintainable architecture**: Monorepo with 7 packages, clear boundaries, pure functions
- **Automated collection**: Worker + RefreshEngine + configurable interval
- **Live hosted demo**: Deployable to Vercel (web) + Docker Compose (full stack)
- **Minimal API-key dependency**: 3 of 4 data sources are public APIs; AI defaults to offline mock

---

## Limitations

- **Demo mode data is illustrative** — when no live credentials are configured, all metrics, projects, and narratives are deterministic demo data, not real ecosystem data
- **Public Solana RPC is rate-limited** — for production use, a paid RPC endpoint (Helius, QuickNode) is recommended to avoid rate-limit errors
- **AI assistant is a language interface only** — it translates Insight's structured data into natural language; it does not perform independent analysis, browse the web, or access external knowledge. A live LLM backend requires an API key; without one, a deterministic offline mock provides grounded answers.
- **No real-time streaming** — data refreshes on a scheduled interval (default 5 minutes), not on every block
- **Snapshot persistence depends on infrastructure** — without PostgreSQL configured, snapshots are in-memory and reset on restart
- **DeFiLlama and CoinGecko are rate-limited** — public APIs have rate limits; for high-frequency refresh, consider using paid tiers or caching strategies
- **Helius is optional** — without a Helius API key, the Solana RPC provider still covers validator/stake/epoch/TPS/inflation metrics, but enhanced on-chain token data is not available

---

## License

This project is built for the Solana ecosystem reporting Mission. All implementation is original.
