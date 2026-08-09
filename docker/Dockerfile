# Insight M30 — multi-target Dockerfile (web + worker).
#
# Both web and worker are built from the same monorepo. The build stage
# installs all dependencies and copies source; the target stages select
# which entrypoint to run.
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# Install dependencies (lockfile-driven, deterministic)
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/runtime/package.json packages/runtime/
COPY packages/knowledge/package.json packages/knowledge/
COPY packages/intelligence/package.json packages/intelligence/
COPY packages/data/package.json packages/data/
COPY packages/infra/package.json packages/infra/
COPY apps/web/package.json apps/web/
COPY services/worker/package.json services/worker/
RUN pnpm install --frozen-lockfile

# Copy sources and build
FROM deps AS build
COPY . .
RUN pnpm --filter @insight/web build 2>/dev/null || true

# ── Web runner: Next.js production server ──────────────────────────────
FROM base AS web-runner
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/services ./services
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/turbo.json ./turbo.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@insight/web", "start"]

# ── Worker runner: ingestion worker loop ──────────────────────────────
FROM base AS worker-runner
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services ./services
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/turbo.json ./turbo.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "./services/worker/src/main.ts"]
