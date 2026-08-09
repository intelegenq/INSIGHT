# Delivery Roadmap

## Phase 1 — Foundation

- [x] pnpm workspace and Turborepo configuration
- [x] Core product and engineering documentation
- [x] Web application scaffold and design system
- [x] Local quality checks and continuous integration

## Phase 2 — Contest MVP

- [x] Ecosystem pulse dashboard with transparent demo data
- [x] Project intelligence page
- [x] Narrative trend exploration
- [x] Cited report generation experience
- [x] Responsive deployment-ready UI

## Phase 3 — Intelligence services

- [x] Ingestion interfaces for on-chain and off-chain sources
- [x] Normalized evidence store and entity graph
- [x] Report and explanation engines
- [x] Scheduled refreshes and source health monitoring

## Phase 4 — Production hardening

- [x] Authentication and saved research (M25 — Authentication & Saved Research)
- [x] PostgreSQL, cache, object storage, and workers (M26 — Database & Worker Infrastructure)
- [x] Observability, evaluation, and security controls (M27 — Observability, Evaluation & Security)
- [x] Multi-chain expansion only after Solana quality is proven (M28 — Multi-Chain Expansion)

## Phase 5 — Production deployment

- [x] Production provider wiring — environment-backed Helius/SolanaRPC/DeFiLlama/CoinGecko (M29)
- [x] Scheduled ingestion worker — RefreshEngine + WorkerRunner (M29)
- [x] Deployable production stack — docker-compose with live credential wiring (M29)
- [x] Product UI capabilities — ecosystem pulse, project intelligence, narratives, cited reports (M29)
- [x] API routes — pulse, projects, project detail, narratives, reports, refresh trigger (M29)

## Phase 6 — AI assistant

- [x] AI domain contracts — AIProvider, AIRequest, AIResponse, structured response, citations (M31)
- [x] AI gateway — OpenRouter + NVIDIA NIM adapters, mock provider, retry/timeout (M31)
- [x] Insight context retrieval — deterministic context over existing data contracts (M31)
- [x] Assistant service — question → context → AI → answer + citations (M31)
- [x] Assistant API — POST /api/assistant with structured response (M31)
- [x] Assistant UI — natural-language interface with citations and references (M31)
- [x] Infrastructure activation — Redis cache, S3/MinIO object store, evaluation wired (M30)
- [x] Deployment readiness — docker-compose web + worker + postgres + redis + minio (M30)

## Phase 7 — Analyst workflow

- [x] Auth UI — login and register pages with session cookie management (M32)
- [x] Saved research dashboard — saved reports, narratives, projects, and sessions (M32)
- [x] Snapshot history — timeline view with snapshot diff comparison (M32)
- [x] Navigation — auth-aware nav with History and Saved links across all pages (M32)

## Phase 8 — Report export & analyst integration

- [x] Report export API — POST /api/reports/export with markdown + JSON formats (M33)
- [x] Evaluated report API — GET /api/reports/evaluated exposing M30 quality verdicts (M33)
- [x] Report artifact retrieval — GET /api/reports/[id]/artifact from ObjectStore (M33)
- [x] Save button on reports page — POST /api/saved integration (M33)
- [x] Export/download UI — markdown and JSON download buttons on reports page (M33)
