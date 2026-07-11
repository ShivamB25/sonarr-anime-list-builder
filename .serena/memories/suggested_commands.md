Use Bun/Bunx exclusively; do not use npm/npx/pnpm/yarn.

Install and development:
- `bun install --frozen-lockfile` — reproducible dependency install.
- `bun run dev` — full Wrangler development server with local D1.
- `bun run dev:local` — Bun server with local SQLite and startup migrations.
- `bun run dev:client` — watch and rebuild the React client.

Validation:
- `bun run db:check` — validate Drizzle journal/snapshot consistency.
- `bun run check:browser` — `tsconfig.json` browser/shared production check.
- `bun run check:worker` — `tsconfig.worker.json` Cloudflare Worker-only check.
- `bun run check:bun` — `tsconfig.bun.json` Bun local/tooling/server integration check.
- `bun run check:test` — `tsconfig.test.json` browser-facing Bun test check.
- `bun run typecheck` — run all four TypeScript 7 checks.
- `bun test` — run the complete Bun test suite.
- `bun run build:client` — Vite client build.
- `bun run build` — db:check + all typechecks + tests + Vite build + Wrangler dry-run.

Database:
- `bun run db:generate -- --name=<name>` or `bunx drizzle-kit generate --name=<name>` — generate a new migration from `src/server/db/schema.ts` into root `drizzle/`.
- `bun run db:migrate:local` — apply committed migrations to Wrangler local D1.
- `bunx wrangler d1 migrations list airing-list-db --remote` — inspect pending production migrations.
- `bun run db:migrate:remote` — apply committed migrations to production D1.
- `bun run db:studio` — open Drizzle Studio.

Deployment:
- `bunx wrangler whoami` — verify the authenticated Cloudflare account.
- `bun run deploy` — db:check + typecheck + tests + Vite build + production Wrangler deploy.
- Live Worker: `https://airing-list-web.edge-5af.workers.dev`.

Repository notes:
- Canonical GitHub repository: `https://github.com/ShivamB25/sonarr-anime-list-builder`.
- Package/Serena project name: `sonarr-anime-list-builder`.
- Wrangler entry: `src/server/index.ts`.
- Static assets: `dist/client`.
- D1 database: `airing-list-db`, binding `DB`.
- Root `drizzle/` is intentional and shared by Drizzle Kit, Wrangler, Docker, Bun local startup, and tests.