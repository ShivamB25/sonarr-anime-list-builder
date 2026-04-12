# Airing List

A seasonal anime tracking platform with Sonarr integration. Browse airing anime by season, build personal watchlists, and generate Sonarr-compatible import URLs — no API keys required.

## Stack

- **Hono** — API framework (Cloudflare Workers)
- **React 19 + Vite** — Client SPA
- **Drizzle ORM + Cloudflare D1** — Database
- **Tailwind CSS v4** — Styling
- **AniList GraphQL API** — Search metadata and background seasonal sync
- **MyAnimeList API** — Supplemental seasonal feed sync source
- **Fribb anime-lists** — AniList/MAL → TVDB ID mapping refresh

## How It Works

1. Browse anime by season (Spring 2026, Summer 2026, etc.) or search by title
2. Seasonal browsing (`/api/anime/seasonal`) reads from D1-backed `seasonal_browse_items`
3. Seasonal Sonarr feed (`/api/anime/season-feed`) reads from D1-backed `season_feed_entries`
4. Background cron sync populates and refreshes those tables from AniList, MyAnimeList, and Fribb mappings
5. Create lists and add anime to them
6. Each list exposes a public URL at `/api/lists/{id}/sonarr`
7. Paste that URL into **Sonarr → Import Lists → Custom List → List URL**
8. Sonarr auto-imports everything from the list using TVDB IDs

No Sonarr API key is stored or needed. Request-time seasonal browsing and season feeds are now D1-backed; only `/api/anime/search` still calls AniList live on request. AniList + MAL seasonal fetches and Fribb mapping refreshes run in the background sync path.

Guest users get a session cookie automatically. Optional username/password accounts are available to persist lists across devices.

## Project Structure

```
src/
  server/
    index.ts              # Hono app entry point
    db/schema.ts          # Drizzle schema (users, lists, seasonal feed + browse tables)
    lib/
      anilist.ts          # AniList GraphQL client for search + background sync
      anime-mapping.ts    # AniList/MAL → TVDB mapping via Fribb
      sync.ts             # Background seasonal sync into D1
      auth.ts             # Cookie-based session auth
    routes/
      auth.ts             # Register, login, logout, session
      anime.ts            # D1-backed seasonal browse/feed + live AniList search
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
