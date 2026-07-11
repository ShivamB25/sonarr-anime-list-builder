Sonarr Anime List Builder is a full-stack TypeScript application for browsing seasonal anime, managing custom anime lists, and exposing Sonarr-compatible list/feed endpoints.

Repository identity:
- GitHub: `https://github.com/ShivamB25/sonarr-anime-list-builder`
- Package name: `sonarr-anime-list-builder`
- Search terms/topics emphasize Sonarr, anime, import lists, AniList, MyAnimeList, TVDB, Cloudflare Workers/D1, Bun, Hono, React, TypeScript, and SQLite.
- The deployed Cloudflare Worker intentionally retains the existing name `airing-list-web`; repository branding and deployment resource names do not need to match.

Current stack:
- Bun 1.3.14 is the only package manager, command runner, local runtime, and test runner.
- Stable TypeScript 7.0.2 provides static checking.
- Cloudflare Workers + Hono provide the backend.
- Cloudflare D1 + Drizzle ORM 0.45.2 provide persistence; Drizzle Kit 0.31.10 generates and validates migrations.
- React 19 + Vite provide the browser client.
- Tailwind CSS v4 provides styling.
- `@chenglou/pretext` provides text measurement.
- AniList, MyAnimeList, and Fribb anime-lists provide upstream metadata/mapping.

Lean TypeScript configuration (simplified from nine files to four):
- `tsconfig.json`: browser production code and shared modules; DOM + Vite types only.
- `tsconfig.worker.json`: Cloudflare Worker/D1 production code, excluding Bun-only entry/adapter files; this is the authoritative guard against Bun/Node APIs leaking into the Worker.
- `tsconfig.bun.json`: the Bun local runtime, tooling configs, and server integration/local-D1 tests. It includes the shared Worker application because the Bun entrypoint deliberately runs that application locally.
- `tsconfig.test.json`: browser-facing Bun tests (`client-api` and `season`) that need DOM plus `bun:test` types.
- Package typechecking runs all four explicitly; there is no solution/base/test-config hierarchy.

Code structure:
- `src/client`: React app, pages, components, hooks, and API client.
- `src/server`: Worker entrypoint, canonical `env.ts`, route modules, database schema, and runtime/upstream helpers.
- `src/shared/types.ts`: plain genuinely shared transport/domain shapes; no DTO framework.
- `src/shared/season.ts`: canonical season constants, labels, validation, and date helper.
- `src/server/db/schema.ts`: authored Drizzle schema source of truth.
- root `drizzle/`: generated SQL migrations, journal, and snapshots shared by Drizzle Kit, Wrangler D1, Docker, Bun SQLite startup, and tests.
- `tests`: Bun behavioral and migration-contract tests.
- `dist/client`: generated frontend assets.

Architecture rule: keep the small existing `client/pages/components` and `server/routes/lib/db` structure. Do not introduce DTO/service/repository/DI/feature-folder layers without a demonstrated need. One TypeScript config is not sufficient because browser and Cloudflare Worker ambient globals conflict, but four focused configs are the minimal practical boundary for this app and its Bun tests.