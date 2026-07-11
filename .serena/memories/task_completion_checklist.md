Before completing application changes:
1. Run the narrowest behavioral tests while iterating.
2. Run `bun run db:check` whenever schema, Drizzle dependencies/config, or `drizzle/` artifacts change.
3. Run `bun run typecheck`; it checks the four honest environments: browser production, Worker production, Bun local/tooling/server integration, and browser-facing Bun tests.
4. Run `bun test` and confirm deterministic isolated tests pass without external network access.
5. Run `bun run build` before yielding any non-trivial release: it includes db:check, all typechecks, all tests, Vite production build, and Wrangler dry-run.
6. For Docker changes, build/run the image when a Docker daemon is available; otherwise state the exact unverified limitation.

Before production deployment:
1. `bunx wrangler whoami`.
2. `bun run db:check`.
3. `bunx wrangler d1 migrations list airing-list-db --remote`.
4. If pending, `bun run db:migrate:remote` before deploying compatible code.
5. `bun run deploy`.
6. Re-list remote migrations; require none pending.
7. Smoke-test `/api/health` and at least one D1-backed endpoint.
8. Record Worker URL/version ID and migration name.

Before committing/pushing:
- Review scope/status and exclude unrelated `.serena/project.yml` or other local tool state unless explicitly requested.
- Include generated migration SQL, terminal snapshot, journal, schema, manifest, and Bun lockfile together.
- Never rewrite an applied migration.
- Use a conventional commit with decision trailers where relevant.
- Push normally; never force unless explicitly requested and justified.

General:
- Bun/Bunx only; no npm/npx/pnpm/yarn.
- Do not treat Vite transpilation as typechecking.
- Do not mix browser and Worker ambient globals merely to reduce config-file count. The current four-config model is the intentionally simplified minimum.