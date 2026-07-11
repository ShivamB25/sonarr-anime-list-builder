Project: airing-list-web

Wrangler deploy/reference workflow (Bun-only):
- Build + production deploy: `bun run deploy`
- Full dry-run validation: `bun run build`
- Migration metadata integrity: `bun run db:check`
- Type checks for browser/Worker/Bun/tooling/tests: `bun run typecheck`
- Tests: `bun test`
- Local Worker dev: `bun run dev` (or `bunx wrangler dev`)
- Local Bun/SQLite dev: `bun run dev:local`
- Client watch only: `bun run dev:client`
- Remote D1 migration list: `bunx wrangler d1 migrations list airing-list-db --remote`
- Remote D1 migration apply: `bun run db:migrate:remote`
- Local D1 migration apply: `bun run db:migrate:local`
- Generate migrations: `bun run db:generate`

Production deployment sequence:
1. `bunx wrangler whoami`
2. `bun run db:check`
3. `bunx wrangler d1 migrations list airing-list-db --remote`
4. If pending, `bun run db:migrate:remote`
5. `bun run deploy`
6. Re-list remote migrations and smoke-test `/api/health` plus a D1-backed route such as `/api/anime/seasonal?...`.

Project-specific Wrangler config:
- Worker name: `airing-list-web`
- Main entry: `src/server/index.ts`
- Static assets: `dist/client`
- D1 binding: `DB`
- D1 database: `airing-list-db`
- D1 database_id: `771d56c0-5874-4fe0-9d84-c2e1e03216f1`
- Cron triggers: `0 * * * *` and `30 * * * *`
- workers.dev URL: `https://airing-list-web.edge-5af.workers.dev`
- Configured custom domain: `airing.aniex.site`

Current deployed/source state (2026-07-12):
- Wrangler Version ID: `ec4c6172-b08a-4aa2-b22b-d44453ed4fe1`
- Production migration `0004_add_query_indexes.sql` applied; no remote migrations pending afterward.
- Live `/api/health` returned `{ "status": "ok" }`.
- Live Summer 2026 seasonal D1 read returned page 1 with 73 total items.
- `main`/`origin/main` commit: `c8eca559f67192cbfaa8d65d5b725e3fd87a8696` (`perf: add Drizzle query indexes and checks`).

Operational notes:
- `bun run build` and `bun run deploy` gate on `db:check`, all TypeScript 7 projects, the Bun test suite, and the Vite client build before Wrangler.
- Production season feed and seasonal browse data are D1-backed; freshness comes from scheduled sync, not live request fetches.
- Short 60s cache layers are only acceleration, not source of truth.
- Secrets must be stored with `bunx wrangler secret put ...`; never commit or print values.
- Keep local artifacts such as `proxies.txt`, `.DS_Store`, and Serena project-state changes out of application commits unless explicitly requested.