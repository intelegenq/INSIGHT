# Architecture Decisions

## ADR-001 — pnpm workspaces with Turborepo

**Status:** accepted

pnpm provides efficient, deterministic monorepo installs. Turborepo coordinates builds and checks across applications and packages.

## ADR-002 — MIT license

**Status:** accepted

The contest MVP is openly licensed to reduce adoption friction and enable community contributions.

## ADR-003 — Vercel for the initial web deployment

**Status:** accepted

The dashboard needs fast preview deployments and a low-operational-overhead demo path. Portable backend and worker workloads remain Docker-compatible.

## ADR-004 — Evidence is a first-class domain object

**Status:** accepted

Every insight, score, and generated brief must be able to retain its source references and time context. This keeps AI outputs inspectable and reduces unsupported claims.
