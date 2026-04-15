# AGENTS.md

## Project Overview

Barcelona is a Next.js 16 App Router application for managing local or hosted Postgres instances. It can:

- create a Postgres role + database + grants from a single slug
- store managed database metadata and plaintext generated passwords in local SQLite
- list databases, show stats, create backups, and inspect per-database details
- protect the UI and API with email/password auth, admin approval, and optional TOTP 2FA

Key technologies:

- Next.js 16.2.3 with the App Router
- React 19
- TypeScript with `strict: true`
- Tailwind CSS 4
- Postgres via `pg`
- local SQLite via `better-sqlite3`
- auth password hashing via `argon2`

## Runtime and Tooling

- Use Bun as the package manager.
- Use Node as the runtime for builds, type-checking, and production behavior.
- In this repo, the working Node path is via `mise`.

Recommended command prefixes:

- `bun install`
- `mise exec node@24.14.1 -- npx tsc --noEmit`
- `mise exec node@24.14.1 -- npx eslint ...`
- `mise exec node@24.14.1 -- npx next build`

If native modules stop loading after a Node version change, rebuild them with:

- `mise exec node@24.14.1 -- npm rebuild better-sqlite3 argon2`

## Next.js Notes

This repository includes a repo-level instruction that this Next.js version may differ from older training data. Before changing framework-specific behavior, read the relevant local docs under:

- `node_modules/next/dist/docs/`

This matters especially for:

- App Router patterns
- route handlers
- `cookies()`
- `redirect()`
- build and deployment behavior

## Setup Commands

Install dependencies:

- `bun install`

Start local development:

- `bun dev`

Production build:

- `mise exec node@24.14.1 -- npx next build`

Start production server after building:

- `mise exec node@24.14.1 -- npx next start`

## Environment and Local Data

The app expects a working Postgres admin connection in `DATABASE_URL`.

Managed database passwords are encrypted with `BARCELONA_SECRET_KEY`.

Optional env vars for generated connection strings:

- `BARCELONA_SECRET_KEY`
- `POSTGRES_CONNECTION_HOST`
- `PGBOUNCER_CONNECTION_HOST`

These are `hostname:port` overrides used when building direct Postgres and PgBouncer URLs for managed databases.

Local state is stored on disk and is gitignored:

- `data/barcelona.sqlite`
- `backups/`

SQLite stores:

- managed database metadata and plaintext generated passwords
- users
- sessions
- 2FA secrets

Do not commit `data/`, `backups/`, or `.env*`.

## Development Workflow

Main app areas:

- `src/app/` for App Router pages and route handlers
- `src/lib/pg.ts` for Postgres reads, provisioning, and connection string generation
- `src/lib/sqlite.ts` for local SQLite persistence
- `src/lib/auth.ts` for sessions, admin approval, and 2FA
- `src/app/db/[name]/` for per-database details and backups
- `src/app/databases/new/` for database creation flow
- `src/app/api/` for protected JSON APIs

The homepage is read/manage-oriented. Database creation is on its own page at `/databases/new`.

## Testing and Verification

There is currently no dedicated unit/integration test suite in this repo. The main validation steps are:

- Type-check: `mise exec node@24.14.1 -- npx tsc --noEmit`
- Lint all app code: `mise exec node@24.14.1 -- npx eslint src/app src/components src/lib`
- Production build: `mise exec node@24.14.1 -- npx next build`

For targeted checks while editing, lint just the touched files:

- `mise exec node@24.14.1 -- npx eslint src/app/home.tsx`

Agents should run the relevant validation commands after changes, and prefer a full `next build` when changing routing, auth, or deployment-sensitive code.

## Code Style and Conventions

- Use TypeScript and keep code type-safe.
- Follow existing App Router patterns in `src/app`.
- Use the `@/` import alias for `src`.
- Prefer existing UI primitives in `src/components/ui/` instead of adding one-off controls.
- Prefer client components only where state, effects, or browser APIs are actually needed.
- Keep copy concise in the UI; avoid redundant subtitles or developer-facing explanatory text.
- Do not add subtitles, helper copy, or card descriptions unless they add real user value; default to no subtitle.
- Use toasts for transient success confirmations such as completed backups or deletions; do not render those as inline success cards.
- Keep sensitive values redacted by default in the UI unless the user explicitly reveals them.

## Auth and Security

- All sensitive pages and APIs should remain protected through helpers in `src/lib/auth.ts`.
- The first registered account is auto-approved admin.
- Later accounts require admin approval before sign-in.
- Passwords are hashed with Argon2.
- 2FA uses TOTP and can be managed from `/settings`.
- Managed database passwords are intentionally stored in plaintext SQLite so they can be viewed later; treat that file as sensitive local state.

When adding new pages or route handlers, decide explicitly whether they require:

- `requirePageUser()`
- `requirePageAdmin()`
- `requireApiUser()`

## Database and Backup Notes

- Managed databases are provisioned from a normalized slug.
- Reserved names and existing roles/databases are rejected.
- Rollback is attempted if provisioning fails partway through.
- Backups are created through the backup API and are surfaced from each database detail page.
- The old standalone backups page has been removed; backup UX belongs on the per-database page.

## Build and Deployment

Deployment is container-oriented.

- `next.config.ts` sets `output: "standalone"`
- `Dockerfile` builds with Bun for dependency install and Node for runtime
- final container runs as non-root and creates `/app/data` and `/app/backups`

Release publishing is automated:

- `.github/workflows/publish-docker.yml`
- publishes `linux/amd64` images to `ghcr.io`
- triggers on GitHub release publication
- tags images with the GitHub release tag

## Pull Request and Change Guidance

Before considering work complete:

- run `mise exec node@24.14.1 -- npx tsc --noEmit`
- run `mise exec node@24.14.1 -- npx eslint ...` for changed files or the full app
- run `mise exec node@24.14.1 -- npx next build` for routing/auth/deployment changes

Keep changes narrow and consistent with the existing product direction:

- the dashboard is operational, not marketing-oriented
- database-specific actions belong on the database detail page
- auth/security flows should feel intentional and minimal

## Common Gotchas

- Do not switch the SQLite layer to Bun-only APIs; this app is Node/Next runtime-oriented.
- If `better-sqlite3` or `argon2` bindings fail, rebuild them with the active Node version under `mise`.
- The shared `Textarea` component defaults to `field-sizing-content`; override that for long secrets/URLs when fixed sizing is needed.
- If you add new Next.js-specific behavior, consult `node_modules/next/dist/docs/` first instead of assuming older patterns still apply.
