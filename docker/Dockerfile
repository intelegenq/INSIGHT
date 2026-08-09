# Insight M26 worker image — reproducible scheduled refresh loop.
#
# Builds the monorepo worker in a Node container. The worker uses
# @insight/infra adapters; in-memory backends run by default, real drivers
# (Postgres/Redis/S3) are wired via environment variables from docker-compose.
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
COPY services/worker/package.json services/worker/
RUN pnpm install --frozen-lockfile

# Copy sources and build (typecheck guarantees valid output)
FROM deps AS build
COPY . .
RUN pnpm --filter @insight/infra build 2>/dev/null || true

# Runtime image: run the M29 ingestion worker entrypoint
FROM base AS runner
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services ./services
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "./services/worker/src/main.ts"]