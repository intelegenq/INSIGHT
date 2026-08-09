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

## Global search boundary (M38)

- GET /api/search?q=<query> returns grouped results across projects, narratives, and evidence — deterministic text matching over existing Insight data, no external search service or AI.
- Results are sorted by relevance tier: exact name match > name starts-with > name/description/note contains.
- The /search page provides a client-side search form, grouped result cards with clickable links to project and narrative detail pages, and a tips section explaining searchable fields.
- InsightService.search() uses existing listProjects(), getNarratives(), and snapshot/runtime evidence — no new data sources, no web search, no AI generation.
- Search link is present in navigation across all pages.

## Cross-entity comparison boundary (M39)

- GET /api/compare?ids=id1,id2,... returns uniform entries with each project's metrics, health scores (from M37's scoreProject), and evidence count — minimum 2 IDs, maximum 10.
- The /compare page provides a checkbox project selector, a side-by-side comparison table with best-value highlighting (higher is better for TVL/volume/health, lower is better for risk), and a health score section.
- InsightService.compareProjects() uses existing listProjects(), getProjectHealth(), and resolveEvidenceIds() — no new data sources, no AI, no external services.
- Not-found IDs are reported separately in the response without causing a 404 for the entire request.
- Compare link is present in navigation across all pages.

## Report PDF export boundary (M40)

- POST /api/reports/export with format:"pdf" returns a self-contained HTML document with inline CSS, optimized for browser print-to-PDF — no external dependencies, no server-side PDF library.
- The PDF HTML includes: report header with metadata, executive summary, catalyst and risk sections, a quality verdict box (from M30's evaluateReport with quality label, evidence stats, and verified flag), and an evidence table with status badges.
- The reports page "Export PDF" button opens the printable HTML in a new browser tab and auto-triggers the print dialog.
- Uses existing getReport(), getEvaluatedReport(), and resolveEvidenceIds() — no new data, no AI generation, no new infrastructure.

## Dashboard customization boundary (M41)

- GET /api/dashboard aggregates pulse metrics, timeline, top projects (by TVL), and narratives into a single response — uses existing getPulse, getTimeline, listProjects, and getNarratives.
- The /dashboard page is a client-side component with a settings panel for toggling section visibility and reordering sections via up/down buttons.
- Section configuration (visible + order) is persisted to localStorage and restored on page load — preferences survive across sessions.
- Default layout: Pulse → Top Projects → Narratives → Research Timeline (all visible, sequential order).
- Uses only existing Insight data contracts — no new data sources, no AI, no external services.

## Snapshot history timeline boundary (M42)

- The /history page is rewritten as a visual timeline: chronological snapshot rail with dot nodes, connecting line, per-node project count and delta from previous snapshot.
- Clicking a timeline node selects it as the active snapshot — 4 metric cards show projects, narratives, evidence, and graph entity counts.
- A delta bar shows the change between the selected snapshot and a compare base (defaults to the previous snapshot), with up/down/flat color coding.
- A compare-base dropdown lets the analyst pick which snapshot to diff against; the existing /api/history?from=&to= endpoint is used unchanged.
- The diff detail section renders summary count cards (added/removed/changed/narratives), a project metric changes table with direction arrows, and a narrative trend changes table.
- Earlier/Later navigation buttons let the analyst browse between historical states without the dropdown.
- All data comes from existing listSnapshots() and compareSnapshots() — no new API routes, no new data, no AI.

## Project trend comparison boundary (M43)

- GET /api/trends/projects/[id] returns an array of chronological trend points, each containing snapshotId, referenceDate, project metrics, and health scores computed via scoreProject at that snapshot's reference date.
- InsightService.getProjectTrend() walks all snapshots chronologically, finds the project in each, resolves its evidence from that snapshot, and computes health — no new data, no AI, no new persistence.
- The /trends page provides a project selector (clickable cards), 4 sparkline summary charts (health, momentum, risk, developer), a per-snapshot detail table with direction arrows, and a large TVL sparkline.
- Sparklines are pure SVG — no external chart library, no client-side dependencies.
- Trend points are bounded: health 0–100, momentum −100 to +100, risk 0–100, developer 0–100.
- Uses existing listSnapshots, scoreProject, and snapshot evidence — no new API routes beyond the trend endpoint, no new data, no AI.

## Initial deployment

- Next.js frontend: Vercel
- API, scheduled collectors, and workers: Docker-compatible service
- Primary store: PostgreSQL
- Cache/queue: Redis
- Artifact storage: S3-compatible object storage

This separates fast product iteration from worker portability.

## Saved search subscriptions boundary (M44)

- The SavedSearch type extends SavedResearch with a persisted search query: id, userId, query, name, savedAt.
- SavedResearchClient.saveSearch() deduplicates by query string — repeated saves return the existing entry.
- The /api/saved route accepts kind:"search" for POST (requires query) and DELETE (by saved-item id).
- The GET /api/saved response now includes a searches array alongside reports, narratives, projects, and sessions.
- The /search page provides a "Save this search" button on the results section and quick-access chips for saved searches on the idle state.
- The /saved page includes a Searches section with clickable links that re-run the search via /search?q=.

## Multi-project trend overlay boundary (M45)

- GET /api/trends/overlay?ids=id1,id2,... returns a map of projectId → { name, points[] } with chronologically sorted trend points.
- Minimum 2 IDs, maximum 10 — validated by the API route.
- InsightService.getMultiProjectTrend() walks all snapshots for all requested projects in a single pass, computing health scores via scoreProject.
- The /trends page overlay section provides checkbox project selection, a compare button, a color-coded legend, and a multi-line SVG chart overlaying health scores.
- Uses existing listSnapshots, scoreProject, and snapshot evidence — no new data, no AI.

## Evidence timeline boundary (M46)

- GET /api/evidence/timeline returns all evidence from all snapshots, deduplicated by ID, sorted by observedAt descending.
- Each evidence entry includes projectIds and narrativeIds — the projects and narratives that reference this evidence across snapshots.
- Optional query params: status (demo/verified/pending/draft), sourceId, projectId for filtering.
- InsightService.getEvidenceTimeline() builds reverse maps from evidence to projects and narratives by walking all snapshots.
- The /evidence page renders a vertical timeline with status-colored dots, filter dropdowns for status and source, and clickable links to associated projects and narratives.
- Uses existing snapshotRepository.list() — no new data, no AI.

## Research session detail boundary (M47)

- GET /api/sessions/[id] returns a single ResearchSession by id.
- PATCH /api/sessions/[id] supports four actions: addProject, removeProject, addNarrative, removeNarrative — each updates the session's projectIds or narrativeIds array and refreshes updatedAt.
- SavedResearchClient provides getSession(), addProjectToSession(), removeProjectFromSession(), addNarrativeToSession(), removeNarrativeFromSession() — all idempotent and file-backed.
- The /saved/[id] page displays the session title, metadata, project and narrative lists with remove buttons, and add controls (dropdown + button) for adding new projects and narratives.
- Session items link to their respective detail pages (/projects/[id] and /narratives/[id]).

## Alert subscriptions boundary (M48)

- AlertSubscription and AlertTrigger types extend SavedResearch with alert subscriptions: id, userId, targetType (project/narrative), targetId, targetName, condition, threshold, status, triggerHistory.
- Alert conditions: health_drop, health_rise, trend_change, new_evidence, tvl_change — each with an optional numeric threshold.
- SavedResearchClient.createAlert() creates a new active alert; triggerAlert() records a trigger event and sets status to "triggered"; removeAlert() deletes the alert.
- The /api/saved route accepts kind:"alert" for POST (requires alert.targetType, alert.targetId, alert.condition) and DELETE (by alert id).
- The /alerts page provides a create form (target type, target, condition, threshold), an alert list with status badges (active/triggered), trigger history log, and remove buttons.
- Alerts link to their target's detail page (/projects/[id] or /narratives/[id]).
- Uses existing SavedResearchClient file-backed persistence — no new infrastructure, no AI.
