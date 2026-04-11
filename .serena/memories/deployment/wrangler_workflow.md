Project: airing-list-web

Wrangler deploy/reference workflow:
- Build + deploy: `bunx vite build && bunx wrangler deploy`
- Dry-run build validation: `bunx vite build && bunx wrangler deploy --dry-run`
- Local dev: `bunx wrangler dev`
- Client watch only: `bunx vite build --watch`
- Remote D1 migration apply: `bunx wrangler d1 migrations apply airing-list-db --remote`
- Local D1 migration apply: `bunx wrangler d1 migrations apply airing-list-db --local`
- Generate migrations: `bunx drizzle-kit generate`

Project-specific Wrangler config:
- Worker name: `airing-list-web`
- Main entry: `src/server/index.ts`
- Static assets: `dist/client`
- D1 binding: `DB`
- D1 database: `airing-list-db`
- D1 database_id: `771d56c0-5874-4fe0-9d84-c2e1e03216f1`
- Cron triggers: `0 * * * *` and `30 * * * *`

Operational notes:
- `npm run build` in package.json already performs Vite build + Wrangler dry-run deploy.
- `npm run deploy` performs Vite build + Wrangler deploy.
- Production season feed and seasonal browse data are D1-backed; freshness comes from scheduled sync, not live request fetches.
- Short 60s cache layers are only acceleration, not source of truth.
- Secrets should be stored with `wrangler secret put ...`; never commit them.
- If local artifacts like `proxies.txt` or `.DS_Store` appear, keep them gitignored and never commit them.
