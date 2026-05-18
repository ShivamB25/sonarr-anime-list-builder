# Airing List

Seasonal anime list builder for Sonarr. Browse airing shows, build lists, and feed them straight into Sonarr via TVDB IDs.

## Stack

- **Hono** — API layer (Cloudflare Workers or self-hosted Bun)
- **React 19 + Vite** — client
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

## Quick start

```bash
bun install
bun run db:migrate:local
bun run dev
```

Open `http://localhost:8787`.

## Docker

Pre-built image: **`shivamb25/anime-airing-list`** ([Docker Hub](https://hub.docker.com/repository/docker/shivamb25/anime-airing-list))

The image bundles a compiled Bun/Hono binary, the built React client, and Drizzle migrations. Data lives in SQLite at `/app/data/airing-list.sqlite`; migrations run automatically on startup.

### Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Random string for signing session cookies |
| `ADMIN_SYNC_TOKEN` | no | Bearer token for the `/api/admin/run-sync` endpoint |
| `MAL_CLIENT_ID` | no | MyAnimeList API client ID (enables MAL as a sync source) |
| `SQLITE_PATH` | no | SQLite database path (default `/app/data/airing-list.sqlite`) |
| `PORT` | no | Server port (default `8787`) |

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
      SESSION_SECRET: "a-long-random-secret-here"
      ADMIN_SYNC_TOKEN: "another-long-random-secret"
      # MAL_CLIENT_ID: "your-mal-client-id"
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

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Wrangler dev server (Cloudflare D1) |
| `bun run dev:local` | Bun server with local SQLite |
| `bun run dev:client` | Watch + rebuild the React client |
| `bun run build` | Build client + dry-run deploy |
| `bun run deploy` | Build + deploy to Cloudflare |
| `bun run db:generate` | Generate a Drizzle migration |
| `bun run db:migrate:local` | Apply migrations to local D1 |
| `bun run db:migrate:remote` | Apply migrations to production D1 |
| `bun run db:studio` | Open Drizzle Studio |

## Deploy to Cloudflare

```bash
bunx wrangler d1 create airing-list-db
# put the returned database_id in wrangler.toml

bun run db:migrate:remote
bun run deploy
```

Set secrets:

```bash
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put ADMIN_SYNC_TOKEN   # optional
```

## Project structure

```
src/
  server/
    index.ts              Hono app + Worker entrypoint
    local.ts              Self-hosted Bun entrypoint
    db/schema.ts          Drizzle schema
    lib/
      anilist.ts          AniList GraphQL client
      anime-mapping.ts    AniList/MAL → TVDB via Fribb
      sync.ts             Background seasonal sync
      auth.ts             Cookie-based sessions
      local-d1.ts         D1-compatible SQLite adapter for self-hosting
    routes/
      auth.ts             Register, login, logout, session
      anime.ts            Seasonal browse/feed + live search
      lists.ts            CRUD lists/items + /sonarr feed
  client/
    main.tsx              React entry
    App.tsx               Hash router
    api.ts                Typed fetch wrapper
    hooks.ts              useUser, useSeasons
    components/           Header, AnimeCard, AuthModal, AddToListModal
    pages/                SeasonBrowser, MyLists, ListDetail
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
