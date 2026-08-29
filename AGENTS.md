# Project guidance

## Runtime boundaries

- Use Bun 1.4.0 for dependency installation, scripts, tests, the self-hosted server, and Docker compilation. Keep `packageManager`, `engines.bun`, the Docker base image, CI, and documentation aligned.
- Cloudflare deployments run in `workerd`, not Bun. Code reachable from `src/server/index.ts` must use Web Platform and Cloudflare Workers APIs only.
- Keep Bun-only APIs in `src/server/local.ts`, `src/server/lib/local-d1.ts`, tests, or build tooling. Never import those two local-runtime modules into the Worker dependency graph.
- `tsconfig.worker.json` is the Worker compatibility boundary. It intentionally excludes the Bun entrypoint and local D1 adapter; do not weaken that exclusion to hide an incompatible import.
- Wrangler is installed through Bun, but its `#!/usr/bin/env node` executable requires Node.js 22 or newer. Do not use `bunx --bun wrangler` or otherwise force Wrangler to execute under Bun.
- `wrangler.toml` is the Cloudflare deployment source of truth. Preserve the D1 binding, migrations directory, assets directory, cron triggers, and required compatibility flags unless the corresponding application behavior changes.

## Validation

Before committing runtime, dependency, deployment, or build changes, run:

```bash
bun install --frozen-lockfile
bun run db:check
bun run typecheck
bun test
bun run build:client
bunx wrangler deploy --dry-run
```

For Docker changes, also build the image and smoke-test both `/api/health` and `/` from the resulting container.

## Database and secrets

- Keep the authored schema in `src/server/db/schema.ts` and generated migrations, snapshots, and journal files in `drizzle/`.
- Create a new migration for schema changes; never edit an already-applied migration.
- Keep credentials out of source and `wrangler.toml`. Manage Worker credentials with `wrangler secret` and self-hosted credentials through the environment.
