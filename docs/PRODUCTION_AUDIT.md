# Production Audit Report — Insight

**Date:** August 10, 2026
**Production URL:** https://insight-web-six.vercel.app
**Deployed Commit:** `8fb63b9`
**Deployment Status:** ✅ Live — all routes returning HTTP 200

---

## Route Status

| Route | HTTP | Render | Data | Notes |
|-------|------|--------|------|-------|
| `/` | 200 | ✅ | Live | Homepage with ecosystem snapshot, Solana Now feed, top protocols table |
| `/dashboard` | 200 | ✅ | Live | Customizable dashboard with projects, narratives |
| `/markets` | 200 | ✅ | Live | Market data, source health, protocol count chart |
| `/analytics` | 200 | ✅ | Live | Rankings table, TVL/category charts, sort + filter controls |
| `/ecosystem` | 200 | ✅ | Live | Project universe grid, category filter, narrative cards |
| `/projects` | 200 | ✅ | Live | Full project listing (428 protocols) |
| `/projects/[id]` | 200/404 | ⚠️ | Live | Works for DeFiLlama IDs (defillama-2269), 404 for others |
| `/solana-now` | 200 | ✅ | Partial | Feed loads but timeline has limited items |
| `/research` | 200 | ✅ | Live | Report viewer with lens selector, export buttons |
| `/reports` | 200 | ✅ | Live | Report listing |
| `/alerts` | 200 | ✅ | Live | Alert subscription UI |
| `/assistant` | 200 | ✅ | ⚠️ | Page loads but AI API returns INTERNAL_ERROR |
| `/search` | 200 | ✅ | Live | Global search with saved searches |
| `/graph` | 200 | ✅ | Live | Knowledge graph entity browser (863 entities) |
| `/trends` | 200 | ✅ | Live | Project trend comparison with sparklines |
| `/history` | 200 | ✅ | Live | Snapshot history diff |
| `/evidence` | 200 | ✅ | ⚠️ | Page loads but API returns 0 evidence items |
| `/compare` | 200 | ✅ | Live | Project comparison |
| `/saved` | 200 | ✅ | Live | Saved research sessions |
| `/health` | 200 | ✅ | Live | Source health monitoring |
| `/narratives` | 200 | ✅ | Live | Narrative listing |
| `/login` | 200 | ✅ | N/A | Auth page |
| `/register` | 200 | ✅ | N/A | Auth page |

### API Routes

| Route | HTTP | Notes |
|-------|------|-------|
| `/api/pulse` | 200 | 428 projects, 428 evidence, 863 graph entities |
| `/api/projects` | 200 | 428 projects with TVL and volume metrics |
| `/api/narratives` | 200 | 3 narratives |
| `/api/dashboard` | 200 | Dashboard composite data |
| `/api/analytics` | 200 | Time-series, category distribution, top by TVL |
| `/api/health` | 200 | coingecko: healthy, defillama: healthy, helius: healthy, solana-rpc: unavailable |
| `/api/evidence` | 200 | Returns 0 items (evidence not populated in API response) |
| `/api/evidence/timeline` | 200 | Timeline endpoint |
| `/api/reports` | 200 | Report listing |
| `/api/reports/evaluated` | 200 | Evaluated report |
| `/api/reports/export` | 200 | Markdown export: 56,942 chars |
| `/api/graph` | 200 | 863 entities (428 project, 428 evidence, 4 source, 3 narrative) |
| `/api/anomalies` | 200 | 0 anomalies (needs 2+ snapshots) |
| `/api/snapshots` | 200 | 0 snapshots listed (in-memory only) |
| `/api/assistant` | 500 | ⚠️ INTERNAL_ERROR — AI provider failing |

---

## Data Sources

| Source | Status | Live Data | Notes |
|--------|--------|-----------|-------|
| **DeFiLlama** | ✅ Healthy | Yes | 428 Solana protocols with TVL, volume, 24h/7d/30d changes |
| **CoinGecko** | ✅ Healthy | Yes | SOL price, market cap, volume |
| **Helius** | ✅ Healthy | Yes | On-chain data (API key configured) |
| **Solana RPC** | ❌ Unavailable | No | Health check failing — public endpoint may be rate-limited on Vercel |
| **AI Provider** | ❌ Error | No | API returns INTERNAL_ERROR — likely env vars not set or model unavailable |

---

## Current Coverage

| Metric | Value | Source |
|--------|-------|--------|
| Projects | 428 | DeFiLlama (Solana-filtered) |
| Categories | 3 | defi (1), infrastructure (1), other (426) |
| Narratives | 3 | Ecosystem (up), DeFi (flat), Infrastructure (flat) |
| Evidence | 428 | Pulse metric (API returns 0 via /api/evidence) |
| Graph Entities | 863 | 428 project + 428 evidence + 4 source + 3 narrative |
| Total TVL | $69.86B | Aggregate across all projects |
| Snapshots | 0 | In-memory only (no persistence in production) |
| Anomalies | 0 | Needs 2+ snapshots for comparison |
| Report Length | 56,942 chars | Markdown ecosystem report |

---

## UI Observations

### Critical

1. **AI Assistant returns INTERNAL_ERROR** — `/api/assistant` returns 500 in production. Likely cause: AI provider env vars not configured in Vercel or free model unavailable. This breaks the core AI copilot feature.

### High

2. **Solana RPC health shows "unavailable"** — The public Solana RPC endpoint may be rate-limited from Vercel's IPs. Network metrics (TPS, epoch, validators) are not accessible.

3. **Category system is broken** — 426 of 428 projects are categorized as "other". Only 1 project is "defi" and 1 is "infrastructure". The category taxonomy is not reflecting the actual Solana ecosystem structure.

4. **Top projects include non-Solana-ecosystem entities** — Binance CEX ($6.01B), Bybit, OKX, Bitfinex, Gate, MEXC, Bitget, Deribit, HTX are all categorized as "other" with Solana TVL. These are CEXs, not Solana ecosystem projects.

5. **"Illustrative Lending Pool" appears as top project** — This is demo/placeholder data appearing alongside real DeFiLlama data, which undermines credibility.

6. **Evidence API returns 0 items** — Pulse says 428 evidence items but `/api/evidence` returns empty. Evidence is not being surfaced through the API properly.

7. **Dual navigation visible on /assistant** — Both the new terminal nav (Overview/Markets/Analytics...) and old nav (Projects/Narratives/Reports...) are rendered. The old nav is hidden via CSS but still in the DOM.

### Medium

8. **Snapshots show 0** — No persistent snapshots in production. Historical charts and anomaly detection cannot function without persisted snapshots.

9. **Solana Now feed has limited items** — Timeline events are present but sparse. No real-time breaking news or data-driven alerts visible.

10. **Charts are empty** — Analytics page shows "No historical data available" for time-series charts because there are 0 snapshots.

11. **Homepage "Solana" entity appears as top project** — The Solana blockchain itself appears as a project with $44.69B TVL, which is confusing in a protocol ranking context.

12. **Narrative detail routes 404** — `/narratives/narrative-ecosystem` returns 404. The ID format may not match.

### Low

13. **Footer says "© 2026"** — Date is correct but could be dynamic.

14. **Search input on analytics has no debounce** — Every keystroke triggers a re-filter.

15. **No loading skeleton** — Pages show blank space while loading data.

---

## Data Quality Observations

1. **Non-Solana-ecosystem entities as projects** — Binance CEX, Bybit, OKX, Bitfinex, Gate, MEXC, Bitget, Deribit, HTX are centralized exchanges that appear as Solana protocols. They should be classified as "market context" not "ecosystem projects".

2. **Category distribution is severely skewed** — 426/428 projects are "other". DeFiLlama categories (Dexes, Lending, Yield, etc.) are not being mapped to Insight categories (defi, infrastructure, consumer, other).

3. **"Illustrative Lending Pool" is demo data** — This appears to be from the DemoProvider and should not appear in production alongside real data.

4. **"Solana" as a project** — The Solana blockchain itself is listed as a project with $44.69B TVL, which conflates network-level data with protocol-level data.

5. **Stale timestamp** — Report shows "Generated: 2026-01-01T00:00:00.000Z" which is a fixed demo timestamp, not the actual generation time.

6. **Evidence not surfaced** — Pulse metric says 428 evidence items but the evidence API and evidence page show 0 items. Evidence may be stored in the snapshot but not queryable through the API.

---

## Analytics Observations

1. **No historical charts** — Time-series charts show "No historical data available" because 0 snapshots are persisted.
2. **Category distribution chart works** — Shows 3 bars (other: 426, defi: 1, infrastructure: 1) but the distribution is not useful.
3. **Top 10 TVL chart works** — Bar chart renders with real TVL data from DeFiLlama.
4. **Sort and filter work** — Users can sort by TVL/Volume/Name and filter by category.
5. **No drill-down from chart** — Clicking chart bars does not navigate to project detail.
6. **No timeframe controls** — 1D/7D/30D/90D buttons are not present because historical data doesn't exist.

---

## Solana-Native Observations

1. **Product does not feel Solana-native** — The terminal shows generic protocol data. There is no Solana-specific context like TPS, slot time, epoch progress, validator counts, or network health visible on the homepage.
2. **No validator analytics** — Despite SolanaRPCProvider having `getVoteAccounts` and `getClusterNodes`, validator data is not surfaced in the UI.
3. **No network analytics page** — TPS, slot time, block height, epoch progress, fees, and REV are not visible anywhere in the UI.
4. **No sector taxonomy** — The product doesn't distinguish DeFi, NFT, DePIN, RWA, Payments, AI, Gaming, Infrastructure, etc. Everything is "other".
5. **CEXs mixed with ecosystem projects** — Binance/Bybit/OKX appear alongside actual Solana protocols like Kamino and Sanctum.

---

## News / Solana Now Observations

1. **Feed is sparse** — Only timeline events from pulse data, no real news sources.
2. **No breaking format** — Items show "BREAKING"/"NEW"/"EVENT" badges but content is generic.
3. **No data-driven alerts** — Anomaly detection returns 0 items because there are no snapshot comparisons.
4. **No external news sources** — No SolanaFloor, Solana official news, or protocol announcements.
5. **Timestamps are static** — All items show the same reference date.

---

## AI Observations

1. **AI is broken in production** — Returns INTERNAL_ERROR (500). Likely cause: `OPENROUTER_API_KEY` or `AI_PROVIDER` not set in Vercel environment, or the free model is unavailable.
2. **Provider names not exposed** — Verified: no "openrouter", "nvidia", "meta-llama" in the HTML.
3. **Copilot launcher is visible** — The "✦ Ask Insight" floating button appears on all pages.
4. **Ctrl+K shortcut wired** — Keyboard shortcut is implemented.
5. **Page context injection implemented** — All client-component pages set page context.
6. **Groundedness enforced in code** — System prompt restricts AI to Insight data only.

---

## Summary of Findings

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 6 |
| Medium | 5 |
| Low | 3 |
| **Total** | **15** |

### Critical
- AI Assistant returns 500 INTERNAL_ERROR in production

### High
- Solana RPC health unavailable
- Category system broken (426/428 "other")
- CEXs mixed with ecosystem projects
- Demo data ("Illustrative Lending Pool") in production
- Evidence API returns 0 despite pulse showing 428
- Dual navigation in DOM on /assistant

### Medium
- No persisted snapshots (0 snapshots)
- Sparse Solana Now feed
- Empty historical charts
- "Solana" listed as a project
- Narrative detail routes 404

### Low
- Static footer year
- No search debounce
- No loading skeletons

---

**Audit complete. No fixes applied. This report is input for the next product-overhaul phase.**
