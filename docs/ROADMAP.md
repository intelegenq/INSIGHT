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

## Phase 9 — Knowledge graph surfacing

- [x] Graph API — GET /api/graph returns graph overview with entity/relationship summaries (M34)
- [x] Entity detail API — GET /api/graph/[id] returns entity with outbound/inbound edges and connections (M34)
- [x] Graph UI — /graph page with entity browser, kind filtering, and entity detail panel (M34)
- [x] Assistant graph context — GraphDataSource wired into /api/assistant route (M34)
- [x] Cache invalidation — knowledge graph cache invalidated on new snapshots (M34)

## Phase 10 — Source health monitoring

- [x] Health API — GET /api/health returns provider health with overall status, per-provider detail, and summary (M35)
- [x] Health UI — /health page with overall status badge, provider cards, and re-check button (M35)
- [x] InsightService.checkSourceHealth() — wires existing SourceHealthMonitor through the service layer (M35)

## Phase 11 — Narrative detail

- [x] Narrative detail API — GET /api/narratives/[id] returns narrative with linked projects and resolved evidence (M36)
- [x] Narrative detail UI — /narratives/[id] page with trend badge, linked project cards, and evidence log (M36)
- [x] Narrative list links — narrative cards on /narratives are now clickable links to detail pages (M36)

## Phase 12 — Project health scores

- [x] Project health API — GET /api/projects/[id] now includes health, momentum, risk, and developer scores (M37)
- [x] Health profile UI — /projects/[id] page shows a health profile section with four bounded score cards (M37)
- [x] InsightService.getProjectHealth() — wires existing scoreProject from @insight/intelligence (M37)

## Phase 13 — Global search

- [x] Search API — GET /api/search?q=<query> returns grouped results across projects, narratives, and evidence (M38)
- [x] Search UI — /search page with query input, grouped result cards, and tips section (M38)
- [x] InsightService.search() — deterministic text matching over existing data contracts (M38)
- [x] Navigation — search link added to nav across all pages (M38)

## Phase 14 — Cross-entity comparison

- [x] Compare API — GET /api/compare?ids=id1,id2 returns uniform entries with metrics, health, and evidence count (M39)
- [x] Compare UI — /compare page with checkbox selector, comparison table, best-value highlighting, and health score section (M39)
- [x] InsightService.compareProjects() — wires existing listProjects, getProjectHealth, and resolveEvidenceIds (M39)
- [x] Navigation — compare link added to nav across all pages (M39)

## Phase 15 — Report PDF export

- [x] PDF format on /api/reports/export — POST with format:"pdf" returns self-contained printable HTML (M40)
- [x] Quality verdict inclusion — PDF export includes M30 ReportVerdict (quality, evidence stats, verified flag) (M40)
- [x] Export PDF button on reports page — opens printable HTML in new tab with auto-print (M40)
- [x] Inline CSS with print media query — no external dependencies, optimized for browser print-to-PDF (M40)

## Phase 16 — Dashboard customization

- [x] Dashboard API — GET /api/dashboard aggregates pulse, timeline, top projects, and narratives in one response (M41)
- [x] Dashboard UI — /dashboard page with section toggles, reordering, and localStorage persistence (M41)
- [x] Customizable sections — pulse, top projects, narratives, timeline can be toggled and reordered (M41)
- [x] Navigation — dashboard link added to nav across all pages (M41)

## Phase 17 — Snapshot history timeline visualization

- [x] Chronological timeline rail — visual nodes sorted by referenceDate with connecting line (M42)
- [x] Per-snapshot metric cards — projects, narratives, evidence, graph entities for selected snapshot (M42)
- [x] Delta bar — change counts between selected snapshot and compare base (M42)
- [x] Diff detail — summary counts, project metric changes table, narrative trend changes table (M42)
- [x] Navigation — earlier/later buttons to browse between historical states (M42)
- [x] Compare base selector — dropdown to pick which snapshot to diff against (M42)
- [x] Responsive timeline — horizontal scroll on mobile, adaptive grids (M42)

## Phase 18 — Project trend comparison over time

- [x] Trend API — GET /api/trends/projects/[id] returns chronological data points with metrics + health scores (M43)
- [x] InsightService.getProjectTrend() — walks all snapshots, computes scoreProject per point (M43)
- [x] Trend UI — /trends page with project selector, sparkline charts for health/momentum/risk/developer, per-snapshot detail table (M43)
- [x] TVL sparkline — large chart showing total value locked over time (M43)
- [x] Trend direction arrows — up/down/flat indicators on health and momentum columns (M43)
- [x] Navigation — trends link added to nav across all pages (M43)
- [x] Responsive — project selector cards, scrollable tables, adaptive sparklines (M43)

## Phase 19 — Saved search subscriptions

- [x] SavedSearch type — core domain type for persisted search queries (M44)
- [x] SavedResearchClient.saveSearch/removeSearch/listSearches — file-backed persistence (M44)
- [x] /api/saved search kind — POST and DELETE support for saved searches (M44)
- [x] Search page save button — ★ Save this search on results page (M44)
- [x] Saved search chips — quick re-run chips on search idle state (M44)
- [x] Saved page searches section — saved searches displayed with re-run links (M44)

## Phase 20 — Multi-project trend overlay

- [x] Overlay API — GET /api/trends/overlay?ids=... returns multi-project trend data (M45)
- [x] InsightService.getMultiProjectTrend() — walks all snapshots for multiple projects (M45)
- [x] Overlay UI — checkbox project selector, compare button, multi-line SVG overlay chart (M45)
- [x] Color-coded legend — per-project color dots with names (M45)
- [x] Min 2 / max 10 project validation (M45)

## Phase 21 — Evidence timeline

- [x] Timeline API — GET /api/evidence/timeline returns all evidence chronologically (M46)
- [x] InsightService.getEvidenceTimeline() — deduplicates evidence across snapshots, sorts by observedAt (M46)
- [x] Project/narrative associations — each evidence entry includes linked project and narrative IDs (M46)
- [x] Status and source filtering — query params for status, sourceId, projectId (M46)
- [x] Timeline UI — /evidence page with vertical timeline rail, status-colored dots, filter controls (M46)
- [x] Clickable links — evidence entries link to associated project and narrative detail pages (M46)

## Phase 22 — Research session detail

- [x] Session detail API — GET /api/sessions/[id] returns single session (M47)
- [x] Session patch API — PATCH /api/sessions/[id] supports addProject, removeProject, addNarrative, removeNarrative (M47)
- [x] SavedResearchClient session methods — getSession, addProjectToSession, removeProjectFromSession, addNarrativeToSession, removeNarrativeFromSession (M47)
- [x] Session detail UI — /saved/[id] page with project/narrative lists, add/remove controls, back to saved (M47)

## Phase 23 — Alert subscriptions

- [x] AlertSubscription + AlertTrigger types — core domain types for alert subscriptions (M48)
- [x] SavedResearchClient.createAlert/removeAlert/listAlerts/triggerAlert — file-backed persistence (M48)
- [x] /api/saved alert kind — POST creates alerts, DELETE removes alerts (M48)
- [x] Alert conditions — health_drop, health_rise, trend_change, new_evidence, tvl_change (M48)
- [x] Trigger history — alerts record trigger events with old/new values and descriptions (M48)
- [x] Alerts UI — /alerts page with create form, alert list, status badges, trigger history log (M48)
