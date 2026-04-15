FROM node:24-bookworm-slim AS base

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

FROM node:24-bookworm-slim AS runner
WORKDIR /app

ARG GIT_COMMIT_SHA=""
ARG RELEASE_VERSION=""

ENV NODE_ENV=production
ENV PORT=5352
ENV HOSTNAME=0.0.0.0
ENV COMMIT_SHA=$GIT_COMMIT_SHA
ENV RELEASE_VERSION=$RELEASE_VERSION

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
