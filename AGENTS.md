# Repository Guidelines

## Project Overview

Sonarr Anime List Builder (Airing List) is an anonymous-first React app for seasonal anime discovery, browser-owned lists, and Sonarr feeds (`[{ "TvdbId": 12345 }]`). It runs on Cloudflare Workers/D1 or self-hosted Bun/SQLite.

### License and AI Use

- Read and preserve `LICENSE`: Airing List No-Training Attribution License, not MIT or OSI-approved open source. Preserve contributor notices, third-party terms, and restrictions; contributions remain subject to this license.
- Coding assistance, review, indexing, builds, and PRs are permitted without prohibited training use. Never harvest, scrape, publish, or upload repository material, substantial extracts, adapted code, prompts, responses, or patches for training, fine-tuning, distillation, model updates, or derived training datasets.
- Use providers/settings that exclude submitted material from training; otherwise use compliant/local alternatives. Repository instructions cannot change provider policy. Send generic upstream questions—not repository code—to external documentation services.
- Training requires separate prior written copyright-holder permission. Attribution alone is insufficient; authorized training must credit the project, authors, and canonical URL in dataset/model documentation.
- Redistribution must preserve the full license, notices, project name, and `https://github.com/ShivamB25/sonarr-anime-list-builder`. Publicly hosted/distributed modifications must provide the readable credit required by `LICENSE`.

## Architecture & Data Flow

- `src/server/index.ts` composes Hono routers and Worker `fetch`/`scheduled` handlers. `src/server/local.ts` runs the same app through Bun, applies SQLite migrations, and serves assets.
- Flow: AniList/MAL → `lib/sync.ts` → database snapshots → `routes/anime.ts` → `src/client/api.ts` → React pages. Browse reads persisted AniList metadata; title search calls AniList. Optional MAL adds season-feed coverage.
- Sync processes one due season per invocation across current/previous years. Follow AniList `hasNextPage`, not approximate totals. Fetch every page before atomic snapshot replacement; mapping failures must not block browse publication or erase the previous feed.
- `lib/anime-mapping.ts` uses Fribb first, then optional TVDB exact-title/alias lookup. Reject ambiguous/invalid IDs; no fuzzy guesses or show-specific overrides. Catalog completeness differs from feed coverage: non-series are excluded from season feeds, and multiple entries can share one TVDB series.
- `routes/lists.ts` enforces guest ownership for private CRUD. `/api/lists/:id/sonarr` is intentionally public, supports TVDB fallback, and deduplicates IDs. Preserve the session cookie that owns each browser's lists.
- `lib/cache.ts` provides memory/Cloudflare Cache API layers. The database remains authoritative; cache public lookup metadata, never credentials. Cache hits do not guarantee cold lookups fit Worker request limits.

## Key Directories

| Path | Purpose |
| --- | --- |
| `src/client/` | React pages/components, API client, hooks, CSS tokens |
| `src/server/routes/` | Hono endpoints, validation, ownership checks |
| `src/server/lib/` | Providers, sync, mapping, auth, cache, local SQLite adapter |
| `src/server/db/` | Authored Drizzle schema |
| `src/shared/` | Runtime-neutral API types and season helpers |
| `drizzle/` | Generated SQL migrations, snapshots, journal |
| `.github/workflows/` | Validation and Docker publication |

## Development Commands

| Command | Purpose |
| --- | --- |
| `bun install --frozen-lockfile` | Install locked dependencies |
| `bun run db:migrate:local && bun run dev` | Prepare local D1 and start Wrangler |
| `bun run build:client && bun run dev:local` | Build assets; run Bun/SQLite with `.env` |
| `bun run dev:client` | Client build-watch, not an HTTP server |
| `bun run typecheck` | Browser, Worker, and Bun/tooling checks |
| `bun run build` | Migration check, typechecks, client build, Worker dry-run |
| `bun run db:generate` / `bun run db:check` | Generate/check migrations |
| `bun run db:migrate:remote` / `bun run deploy` | Remote migration / production deployment |
| `docker compose -f docker-compose.dev.yml up --build` | Build/run the self-hosted container |

No test or lint command is configured. Scripts live in `package.json`, not a scripts directory. Servers default to port `8787`; Vite outputs `dist/client`.

## Code Conventions & Common Patterns

- Strict TypeScript/ES modules; two-space indentation, double quotes, semicolons. Match existing PascalCase React components, camelCase symbols, and kebab-case server filenames.
- Narrow external JSON from `unknown`; share API contracts through `src/shared/types.ts`. Use type-only imports and explicit validation/status responses.
- Inject dependencies through typed Hono `c.env` (`env.ts`) and explicit function arguments, not a DI container. Await data-affecting work; propagate provider errors. Scheduled work uses `ctx.waitUntil`.
- React uses local hooks and hash navigation, not a global store/router framework. Reuse `api.ts` error helpers, `AbortController` cleanup, and loading/error/finally patterns.
- Use parameterized Drizzle/D1 queries and atomic bulk snapshot batches. Author schema in `src/server/db/schema.ts`; generate new migrations in `drizzle/`. Never modify already-applied migrations.
- Keep the UI anonymous-first: no signup/login/password/profile/logout UI, even though server auth routes exist.
- Reuse `src/client/index.css` tokens: dark editorial surfaces, coral actions, serif headings, compact metadata, image-led cards. Support 320px without overflow; long-URL page grids need `minmax(0, 1fr)`. Keep actions keyboard/touch/pointer-accessible, not hover-only. Native dialogs must focus, contain tab navigation, close on Escape, and restore focus.

### How We Work

- Work directly from evidence; ask only for unavailable credentials or consequential choices. Keep updates terse. Prefer focused fixes over unrelated cleanup, speculative infrastructure, or dependency upgrades.
- Use parallel `task` agents for independent slices when useful/requested. Define ownership/interfaces; one integration owner runs final checks after edits converge.
- Trace affected callers and reuse existing patterns; use codegraph/LSP when available. Evaluate advisor findings against current code and fix valid cross-path gaps.
- Use Context7 for current/version-matched APIs, Firecrawl developer index for primary-source issues/PRs/contracts, and DeepWiki for upstream implementation context. “Latest practices” does not mean changing pinned versions.
- Prove behavior in the target runtime, update relevant existing docs, and remove throwaway scaffolding. Report exercised evidence and blockers; distinguish local changes, deployment, and production refresh.

## Important Files

- `src/server/index.ts`, `local.ts`, `env.ts`: entrypoints and bindings.
- `src/server/lib/sync.ts`, `anime-mapping.ts`, `anilist.ts`, `mal.ts`: provider/sync contracts; `local-d1.ts`: Bun-only adapter.
- `src/client/main.tsx`, `App.tsx`, `api.ts`, `index.css`: bootstrap, navigation, transport, theme.
- `package.json`, `bun.lock`, `tsconfig*.json`: scripts, dependencies, runtime boundaries.
- `wrangler.toml`, `vite.config.ts`, `drizzle.config.ts`, `Dockerfile`: deployment/build/schema configuration.
- `README.md`, `.env.example`, `LICENSE`: operator instructions, credential names, legal terms.

## Runtime/Tooling Preferences

- Use **Bun 1.4.0** for installs, scripts, self-hosting, and Docker compilation. Keep manifest/runtime pins, lockfile, Docker, CI, and docs aligned.
- Cloudflare runs **workerd**, not Bun. The `src/server/index.ts` dependency graph must use Web Platform/Workers APIs. Keep Bun-only APIs in `local.ts`, `lib/local-d1.ts`, or tooling; never import those local-runtime modules into the Worker graph.
- Preserve separate browser/Worker/Bun TypeScript configs and `tsconfig.worker.json` exclusions; do not weaken them to hide incompatible imports.
- Wrangler requires **Node.js 22+** via its shebang. Use `bunx wrangler`, never `bunx --bun wrangler`.
- `wrangler.toml` owns the `DB` binding, migrations/assets paths, compatibility flags, and twice-hourly cron triggers. Preserve them unless corresponding behavior changes.
- Keep credentials out of source/config/chat. Use Worker secrets or ignored local environment files: `MAL_CLIENT_ID`, `TVDB_API_KEY`, `ADMIN_SYNC_TOKEN`. Manual forced sync: `POST /api/admin/run-sync?season=FALL&year=2026&force=true` with the admin bearer token.

## Testing & QA

There is **no permanent test suite/framework, coverage target, or lint setup**. The user explicitly removed the suite; do not recreate it or add permanent tests unless requested.

Before delivering runtime/dependency/deployment/build changes:

```bash
bun install --frozen-lockfile
bun run db:check
bun run typecheck
bun run build:client
bunx wrangler deploy --dry-run
```

Use temporary Bun/`workerd` smoke checks and remove them afterward. Sync checks should cover pagination, current/previous seasons, source failures, snapshot retention, and seasonal/custom feeds. Inspect actual browser surfaces for UI changes. Builds are not behavioral proof; missing credentials limit live-provider claims, not local verification. For Docker changes, build the image and smoke-test `/api/health` and `/` from the resulting container.
