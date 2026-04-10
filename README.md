# Airing List

A seasonal anime tracking platform with Sonarr integration. Browse airing anime by season, build personal watchlists, and generate Sonarr-compatible import URLs — no API keys required.

## Stack

- **Hono** — API framework (Cloudflare Workers)
- **React 19 + Vite** — Client SPA
- **Drizzle ORM + Cloudflare D1** — Database
- **Tailwind CSS v4** — Styling
- **AniList GraphQL API** — Anime metadata (free, no auth)
- **Fribb anime-lists** — AniList → TVDB ID mapping

## How It Works

1. Browse anime by season (Spring 2026, Summer 2026, etc.) or search by title
2. Create lists and add anime to them
3. Each list exposes a public URL at `/api/lists/{id}/sonarr`
4. Paste that URL into **Sonarr → Import Lists → Custom List → List URL**
5. Sonarr auto-imports everything from the list using TVDB IDs

No Sonarr API key is stored or needed. The mapping from AniList IDs to TVDB IDs is handled server-side via Fribb's anime-lists dataset (cached in-memory, refreshed every 6 hours). The Sonarr endpoint itself is cached for 1 hour.

Guest users get a session cookie automatically. Optional username/password accounts are available to persist lists across devices.

## Project Structure

```
src/
  server/
    index.ts              # Hono app entry point
    db/schema.ts          # Drizzle schema (users, lists, list_items)
    lib/
      anilist.ts          # AniList GraphQL client
      anime-mapping.ts    # AniList → TVDB mapping via Fribb
      auth.ts             # Cookie-based session auth
    routes/
      auth.ts             # Register, login, logout, session
      anime.ts            # Seasonal browse & search (AniList proxy)
      lists.ts            # CRUD lists/items + public /sonarr feed
  client/
    main.tsx              # React entry
    App.tsx               # Router (hash-based)
    api.ts                # Typed fetch wrapper
    hooks.ts              # useUser, useSeasons
    components/           # Header, AnimeCard, AuthModal, AddToListModal
    pages/                # SeasonBrowser, MyLists, ListDetail
```

## Setup

```bash
bun install
bun run db:migrate:local
bun run dev
```

The dev server starts at `http://localhost:8787`. No `.env` or API keys required.

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start local dev server (Wrangler) |
| `bun run dev:client` | Watch-rebuild the React client |
| `bun run build` | Build client + dry-run deploy |
| `bun run deploy` | Build client + deploy to Cloudflare |
| `bun run db:generate` | Generate Drizzle migration from schema changes |
| `bun run db:migrate:local` | Apply migrations to local D1 |
| `bun run db:migrate:remote` | Apply migrations to production D1 |
| `bun run db:studio` | Open Drizzle Studio |

## Deploy to Cloudflare

```bash
# Create the D1 database
bunx wrangler d1 create airing-list-db

# Update database_id in wrangler.toml with the returned ID

# Apply migrations to production
bun run db:migrate:remote

# Deploy
bun run deploy
```

Set `SESSION_SECRET` as a Cloudflare Workers secret:

```bash
bunx wrangler secret put SESSION_SECRET
```

## Sonarr Feed Format

The `/api/lists/{id}/sonarr` endpoint returns:

```json
[
  { "TvdbId": 418666 },
  { "TvdbId": 75837 }
]
```

This is the exact format Sonarr's Custom Import List expects.
