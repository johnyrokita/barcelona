# Pinned to a patched release; bump on Node security releases.
ARG NODE_VERSION=24.22.3

FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl python3 make g++ unzip \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app

ARG GIT_COMMIT_SHA=""
ARG RELEASE_VERSION=""

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public

ENV NODE_ENV=production
ENV COMMIT_SHA=$GIT_COMMIT_SHA
ENV RELEASE_VERSION=$RELEASE_VERSION
RUN ./node_modules/.bin/next build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ARG GIT_COMMIT_SHA=""
ARG RELEASE_VERSION=""

ENV NODE_ENV=production
ENV PORT=5352
ENV HOSTNAME=0.0.0.0
ENV COMMIT_SHA=$GIT_COMMIT_SHA
ENV RELEASE_VERSION=$RELEASE_VERSION

# The backup API shells out to pg_dump, which refuses to dump servers newer
# than itself. Debian's client is too old, so install it from the PGDG repo;
# bump the major when a new Postgres release lands.
ARG PG_CLIENT_VERSION=18
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSL --retry 3 --retry-all-errors -o /usr/share/keyrings/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-${PG_CLIENT_VERSION} \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /app/data /app/backups \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 5352

CMD ["node", "server.js"]
