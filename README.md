# Sonarr Anime List Builder

Open-source seasonal anime import-list builder for Sonarr. Browse AniList and
MyAnimeList metadata, create custom lists, and expose Sonarr-compatible TVDB
feeds. Run it on Cloudflare Workers with D1 or self-host it with Bun and SQLite.

## Stack

- **Hono** — API layer (Cloudflare Workers or self-hosted Bun)
- **React 19 + Vite + TypeScript 7** — client
- **Drizzle ORM** — storage (Cloudflare D1 or plain SQLite)
- **Tailwind CSS v4** — styling
- **AniList + MyAnimeList** — metadata and background sync
- **Fribb anime-lists** — AniList/MAL → TVDB ID mapping

## How it works

1. Browse by season or search by title.
2. Seasonal data (`/api/anime/seasonal`, `/api/anime/season-feed`) is populated by background cron jobs that pull from AniList, MAL, and Fribb.
3. Create lists and add shows to them.
4. Each list exposes a Sonarr-compatible feed at `/api/lists/{id}/sonarr`.
5. Paste that URL into **Sonarr → Import Lists → Custom List → List URL**. No API key needed.

Guest sessions are automatic (cookie-based). Create an account if you want lists to survive across devices.

## Setup

Use Bun 1.4.0. The project uses the stable TypeScript 7 release.

```bash
bun install --frozen-lockfile
bun run db:migrate:local
bun run dev
```

Open `http://localhost:8787`.

For the self-hosted Bun runtime with local SQLite, build the client first:

```bash
bun run build:client
bun run dev:local
```

## Runtime compatibility

| Path | Runtime | Bun-native APIs |
| --- | --- | --- |
| Self-hosted server and Docker image | Bun 1.4.0 | Supported in `src/server/local.ts` and `src/server/lib/local-d1.ts` |
| Cloudflare deployment | `workerd` via Wrangler | Not supported; use Web Platform and Workers APIs |
| Wrangler CLI | Node.js 22+ | Wrangler is installed with Bun, but `bunx` follows its Node shebang |

`tsconfig.worker.json` enforces this boundary by excluding the Bun-only
entrypoint and local D1 adapter. Do not run Wrangler with `bunx --bun` or import
those local-runtime modules into code reachable from `src/server/index.ts`.

## Docker

Pre-built image: **`shivamb25/anime-airing-list`** ([Docker Hub](https://hub.docker.com/repository/docker/shivamb25/anime-airing-list))

The image bundles a compiled Bun/Hono binary, the built React client, and Drizzle migrations. Data lives in SQLite at `/app/data/airing-list.sqlite`; migrations run automatically on startup.

### Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `ADMIN_SYNC_TOKEN` | no | Bearer token for the `/api/admin/run-sync` endpoint |
| `MAL_CLIENT_ID` | no | MyAnimeList API client ID; enables MAL as a sync source |
| `TVDB_API_KEY` | no | TVDB v4 API key; resolves missing TVDB mappings after the Fribb lookup |
| `SQLITE_PATH` | no | SQLite database path (default `/app/data/airing-list.sqlite`) |

### Production (pull from Docker Hub)

`docker-compose.yml`:

```yaml
services:
  app:
    image: shivamb25/anime-airing-list:latest
    pull_policy: always
    ports:
      - "8787:8787"
    environment:
      ADMIN_SYNC_TOKEN: "a-long-random-admin-token"
      # MAL_CLIENT_ID: "your-mal-client-id"
      # TVDB_API_KEY: "your-tvdb-api-key"
      # SQLITE_PATH: /app/data/airing-list.sqlite
    volumes:
      - airing-list-data:/app/data
    restart: unless-stopped

volumes:
  airing-list-data:
```

Or use a `.env` file instead of `environment`:

```bash
cp .env.example .env   # then edit values
```

And swap the `environment:` block for:

```yaml
    env_file:
      - path: .env
        required: false
```

Then:

```bash
docker compose up -d
```

### Development (build locally)

`docker-compose.dev.yml`:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: anime-airing-list:dev
    pull_policy: never
    ports:
      - "8787:8787"
    env_file:
      - path: .env
        required: false
    volumes:
      - airing-list-dev-data:/app/data

volumes:
  airing-list-dev-data:
```

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Updating

```bash
docker compose pull
docker compose up -d
```

### Logs

```bash
docker compose logs -f app
```

## Development and validation

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Wrangler development server with local D1 |
| `bun run dev:local` | Start the Bun server with local SQLite |
| `bun run dev:client` | Watch and rebuild the React client |
| `bun run typecheck` | Type-check the browser, Worker, Bun/tooling, and tests |
| `bun test` | Run the Bun test suite |
| `bun run build:client` | Build the React client |
| `bunx wrangler deploy --dry-run` | Build the Worker without deploying |
| `bun run build` | Run all validation and both production builds |
| `bun run deploy` | Validate, build, and deploy to Cloudflare |
| `bun run db:check` | Validate Drizzle migration journal and snapshots |
| `bun run db:generate` | Generate a Drizzle migration |
| `bun run db:migrate:local` | Apply migrations to local D1 |
| `bun run db:migrate:remote` | Apply migrations to production D1 |
| `bun run db:studio` | Open Drizzle Studio |

The authored schema lives in `src/server/db/schema.ts`; generated SQL, snapshots,
and the journal live together in the conventional root `drizzle/` directory.
Commit those generated artifacts together and never edit a migration that has
already been applied. Create a new migration for every subsequent schema change.

Run each validation step independently:

```bash
bun run db:check
bun run typecheck
bun test
bun run build:client
bunx wrangler deploy --dry-run
```

## Deploy to Cloudflare

```bash
bunx wrangler d1 create airing-list-db
# put the returned database_id in wrangler.toml

bun run db:migrate:remote
bun run deploy
```

Set optional API credentials and the admin token as Worker secrets:

```bash
bunx wrangler secret put MAL_CLIENT_ID
bunx wrangler secret put TVDB_API_KEY
bunx wrangler secret put ADMIN_SYNC_TOKEN
```

## Runtime structure

```
src/
  server/
    index.ts              Hono app, Cloudflare Worker, and scheduled sync entrypoint
    local.ts              Self-hosted Bun and SQLite entrypoint
    env.ts                Worker binding types
    db/schema.ts          Drizzle schema
    lib/                  Auth, upstream clients, caching, sync, and local D1 adapter
    routes/               Auth, anime, and list HTTP routes
  client/
    main.tsx              React entrypoint
    App.tsx               Client router and page shell
    api.ts                Typed API client
    hooks.ts              Client data hooks
    components/           Shared UI components
    pages/                Season browser and list pages
  shared/                 Types and season parsing shared by both runtimes
```

## Sonarr feed format

`/api/lists/{id}/sonarr` returns:

```json
[
  { "TvdbId": 418666 },
  { "TvdbId": 75837 }
]
```

This is what Sonarr expects for a Custom Import List.
