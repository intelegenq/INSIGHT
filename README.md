# Insight

**Real-time intelligence for the Solana ecosystem.**

Insight is a Solana-native intelligence terminal that continuously collects, analyzes, and reports on the state of the Solana ecosystem — from network performance and validator health to DeFi TVL, protocol metrics, narratives, and breaking events.

Built for the Mission: _Create a comprehensive, automatically updating report on the current state of the Solana ecosystem._

## 🔗 Live Demo

**https://insight-web-six.vercel.app**

Deployed on Vercel with the latest build — Linear.app UI, live X feed, per-protocol
detail pages, and rate-limit caching. Serves real live Solana data from public APIs
(no API keys required).

---

## What Insight Is

Insight is not a generic crypto dashboard. It is a **Solana-first intelligence terminal** that combines:

- **Real-time data collection** from Solana RPC, DeFiLlama, CoinGecko, and Helius
- **Evidence-backed analytics** — every metric traces back to a source
- **Anomaly detection** — machine-detected significant changes surface as alerts on the Network page
- **Breaking intelligence feed** — Solana Now delivers real-time ecosystem events
- **Live X / Twitter feed** — recent posts from key Solana ecosystem accounts on the dashboard
- **Historical analysis** — snapshot-based time-series for trend comparison
- **Grounded AI copilot** — ask questions about Solana from any page, answered from Insight's collected data only
- **Report generation** — Markdown, JSON, and PDF exports with evidence citations
- **Linear.app-inspired UI** — floating rounded app shell, monochrome palette, nested collapsible navigation, dark + light themes

### Who It's For

- **Ecosystem researchers** tracking Solana protocol health and trends
- **Traders and analysts** monitoring TVL, volume, and market movements
- **Validators and infrastructure operators** watching network performance
- **Mission judges** evaluating comprehensive Solana ecosystem reporting

---

## Core Capabilities

| Capability            | Description                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Dashboard**         | Homepage with SOL market snapshot, top protocols, latest news, and a live X feed   |
| **Network**           | Solana network health — TPS, epoch, validators, inflation, fees, and anomalies     |
| **Analytics**         | Overview aggregate metrics + per-protocol detail pages (TVL history, peers, chains)|
| **Analysis Sidebar**  | Nested, collapsible categories (DeFi, Lending, Yield, LST, Perps, RWA, Bridges, …) |
| **Solana Now**        | Real-time intelligence feed with BREAKING / NEW / EVENT / DATA ALERT badges        |
| **Research**          | Evidence-backed reports with Markdown / JSON / PDF export                          |
| **Evidence**          | Chronological evidence timeline with source attribution and status tracking        |
| **Historical**        | Snapshot comparison and diff analysis over time                                    |
| **AI Copilot**        | Global floating chat accessible from every page, grounded in Insight data          |
| **Reports**           | Auto-generated research briefs with executive summary, evidence, and caveats       |
| **Anomaly Detection** | TVL drops, volume surges, validator delinquency spikes, TPS anomalies, price moves |

---

## Architecture

```
Data Sources → Providers → Normalization → Evidence → Snapshots → Intelligence → Reports / Dashboard / AI
```

### Pipeline

1. **Sources** — Solana RPC, DeFiLlama, CoinGecko, Helius
2. **Providers** — Fetch raw data from each source
3. **Normalization** — Transform raw data into Insight domain model
4. **Evidence** — Attach source, status, timestamp, and reference URL
5. **Snapshots** — Persist complete ecosystem state at a point in time
6. **Intelligence** — Health scoring, narrative detection, anomaly detection
7. **Reports** — Generate Markdown / JSON / PDF with evidence citations
8. **Dashboard** — Interactive terminal UI with charts, tables, and feeds
9. **AI** — Natural-language interface over Insight data (not a data source)

### AI Architecture

The AI copilot is **NOT** the source of truth. It is only a natural-language interface.

- AI receives bounded context from Insight's collected data (projects, evidence, narratives, reports, health, pulse, snapshots)
- AI cannot browse the web, invent metrics, or access external knowledge
- AI provider configuration is server-side — no provider details in the UI
- If data is unavailable, the AI and UI state that clearly

---

## Data Sources

### Sources working without credentials (public APIs)

| Source          | Data                                                                  | API Key | Cache window |
| --------------- | --------------------------------------------------------------------- | ------- | ------------ |
| **Solana RPC**  | Epoch, validators, TPS, inflation, cluster nodes, performance samples | None    | live         |
| **DeFiLlama**   | Protocol TVL, chain breakdowns, DEX volume, fees, stablecoins         | None    | 6 hours      |
| **CoinGecko**   | SOL price, market cap, 24h volume, circulating supply                 | None    | 5 minutes    |
| **SolanaFloor** | Solana news headlines, ETF flow tracker (scraped)                     | None    | 30 minutes   |
| **X / Twitter** | Recent posts from key Solana accounts (via Nitter → rss2json bridge)  | None    | 30 minutes   |

### Rate-limit protection (caching)

External APIs are wrapped with Next.js incremental static regeneration
(`fetch(url, { next: { revalidate: N } })`). Each upstream is fetched at most
once per cache window, no matter how many visitors hit the page — so DeFiLlama
is called at most once every 6 hours, CoinGecko every 5 minutes, and the X /
news feeds every 30 minutes. This eliminates rate-limit exhaustion without any
extra cron infrastructure; Vercel serves the cached response to everyone else.

### Sources requiring credentials (optional)

| Source         | Data                                        | Variable                | Behavior if Absent                       |
| -------------- | ------------------------------------------- | ----------------------- | ---------------------------------------- |
| **Helius**     | Enhanced on-chain data, transaction details | `HELIUS_API_KEY`        | Falls back to public Solana RPC          |
| **AI Backend** | Natural-language AI assistant               | `AI_PROVIDER` + API key | Falls back to deterministic offline mock |

### Demo Mode

Insight works without any API keys. Without credentials:

- DeFiLlama, CoinGecko, and Solana RPC provide **real live data**
- Helius-enhanced features show **unavailable** (not fabricated)
- AI assistant uses **mock provider** (deterministic offline responses grounded in Insight data)
- Evidence status clearly shows **LIVE** vs **DEMO** vs **PENDING** vs **UNAVAILABLE**

---

## Requirements

- **Node.js** 22.x
- **pnpm** 10.x
- **Docker** (optional, for Docker Compose deployment)

---

## Quick Start

Insight runs with **zero API keys** — DeFiLlama, CoinGecko, and Solana RPC all
serve real live data from public endpoints out of the box.

```bash
# 1. Clone
git clone https://github.com/intelegenq/INSIGHT.git
cd INSIGHT

# 2. Install dependencies (pnpm 10.x required)
pnpm install

# 3. Configure environment (optional — defaults work with no keys)
cp apps/web/.env.example apps/web/.env.local

# 4. Run the dev server
pnpm run dev
```

Open **http://localhost:3000** — the dashboard loads with live Solana data immediately.

### Production build

```bash
pnpm run build      # compile all packages + Next.js app
pnpm run start      # serve the production build on port 3000
```

> **Note:** if you don't have pnpm, install it first: `npm install -g pnpm@10.14.0`
> (or `corepack enable && corepack prepare pnpm@10.14.0 --activate`). Node.js **22.x** is required.

### For enhanced data (optional keys)

Edit `apps/web/.env.local` and add any of:

```env
HELIUS_API_KEY=your_key
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=your_model
```

Everything degrades gracefully — missing keys never fabricate data; they show
`unavailable` or fall back to a public endpoint.

---

## Environment Variables

| Variable                     | Required | Default                               | Purpose                         |
| ---------------------------- | -------- | ------------------------------------- | ------------------------------- |
| `SOLANA_RPC_URL`             | No       | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint             |
| `DEFILLAMA_API_URL`          | No       | `https://api.llama.fi`                | DeFiLlama API endpoint          |
| `COINGECKO_API_URL`          | No       | `https://api.coingecko.com/api/v3`    | CoinGecko API endpoint          |
| `HELIUS_API_KEY`             | No       | (empty)                               | Helius enhanced on-chain data   |
| `AI_PROVIDER`                | No       | `mock`                                | LLM backend selection           |
| `OPENROUTER_API_KEY`         | No       | (empty)                               | AI backend API key              |
| `OPENROUTER_BASE_URL`        | No       | (empty)                               | AI backend base URL             |
| `OPENROUTER_MODEL`           | No       | (empty)                               | AI backend model name           |
| `INSIGHT_POSTGRES_URL`       | No       | (empty)                               | PostgreSQL connection string    |
| `INSIGHT_REDIS_URL`          | No       | (empty)                               | Redis connection string         |
| `INSIGHT_S3_ENDPOINT`        | No       | (empty)                               | S3-compatible object storage    |
| `INSIGHT_S3_BUCKET`          | No       | (empty)                               | Object storage bucket           |
| `INSIGHT_WORKER_INTERVAL_MS` | No       | `300000`                              | Worker refresh interval (5 min) |

---

## Docker / Production

```bash
# Build and start all services
docker compose up --build -d

# View logs
docker compose logs -f web
docker compose logs -f worker

# Stop
docker compose down
```

### Docker Compose Stack

- **web** — Next.js application (port 3000)
- **worker** — Automated refresh worker
- **PostgreSQL** — Snapshot persistence
- **Redis** — Cache layer
- **MinIO** — S3-compatible object storage

---

## Automation

The worker runs a scheduled refresh loop:

1. Fetch data from all configured providers
2. Normalize into Insight domain model
3. Attach evidence with source attribution
4. Persist snapshot
5. Calculate health scores and narratives
6. Run anomaly detection against previous snapshot
7. Update reports and feeds

Default interval: 5 minutes (configurable via `INSIGHT_WORKER_INTERVAL_MS`)

Manual refresh: `POST /api/refresh`

---

## AI Copilot

The AI copilot is accessible from **every page** via:

- Floating "✦ Ask Insight" button (bottom-right)
- Keyboard shortcut: `Ctrl/Cmd + K`

The copilot automatically receives **page context** — it knows which page you're viewing and tailors responses accordingly.

The AI:

- Answers from Insight's collected data only
- Cites evidence sources
- References projects and narratives
- Explains anomalies and trends
- Does NOT browse the web or invent facts

Provider details are hidden from the UI. The interface shows only "Connected" or "Offline".

---

## Development

```bash
pnpm run dev           # Start dev server (all packages, parallel)
pnpm run build         # Production build
pnpm run start         # Serve the production build (port 3000)
pnpm run test          # Run all tests
pnpm run typecheck     # TypeScript type checking
pnpm run format        # Format code
pnpm run format:check  # Check formatting
```

---

## Project Structure

```
apps/web/          Next.js application (UI + API routes)
components/        Reusable UI components (Copilot, charts)
packages/
  core/            Domain types and interfaces
  data/            Data providers and transformers
  intelligence/    Health scoring, narratives, anomaly detection
  runtime/         Snapshot management and history
  ai/              AI assistant and context retrieval
  knowledge/       Knowledge graph
  infra/           Infrastructure (cache, storage, worker)
services/worker/   Automated refresh worker
```

---

## Security / Secrets

- Credentials belong in environment variables only
- No secrets are committed to the repository
- `.env` and `.env.local` are gitignored
- AI provider keys are server-side only — never exposed client-side

---

## Mission Judging Criteria

| Criterion             | Implementation                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Comprehensiveness** | 428+ Solana protocols, network metrics, validators, DeFi TVL, SOL price, narratives, evidence  |
| **Automation**        | Scheduled worker with configurable interval, automatic snapshot persistence, anomaly detection |
| **Data Sources**      | Solana RPC, DeFiLlama, CoinGecko, Helius — 3 of 4 work without any API key                     |
| **Anomaly Detection** | TVL drops/rises, volume surges, validator delinquency spikes, TPS anomalies, price moves       |
| **Reports**           | Markdown, JSON, PDF exports with evidence citations and quality verdicts                       |
| **Dashboard**         | Dark terminal UI with 25+ pages, charts, tables, real-time feed                                |
| **AI**                | Global copilot grounded in Insight data, page-context aware, no web browsing                   |
| **Evidence**          | Every metric traces to source with timestamp, status, and reference URL                        |
| **Live Demo**         | Deployed on Vercel with real Solana data                                                       |

---

## Limitations

- Historical charts require multiple snapshots — trigger refreshes to build time-series
- ETF flow data and institutional activity are not available — shown as unavailable, not fabricated
- NFT, DePIN, and RWA analytics depend on data source availability — architecture supports plugging in additional sources
- AI assistant is a language interface only — it does not perform independent analysis or access external knowledge
- Free-tier AI models may have rate limits or availability constraints

---

## License

MIT
