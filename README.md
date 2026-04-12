# Airing List

A seasonal anime list builder for Sonarr. Browse airing shows by season, create lists, and use the generated Sonarr feed URL to import them.

## Stack

- **Hono** for the Cloudflare Workers API
- **React 19 + Vite** for the client
- **Drizzle ORM + Cloudflare D1** for storage
- **Tailwind CSS v4** for styling
- **AniList GraphQL API** for search metadata and background seasonal sync
- **MyAnimeList API** as an additional seasonal sync source
- **Fribb anime-lists** for AniList/MAL to TVDB ID mapping

## How it works

1. Browse anime by season or search by title.
2. Seasonal browsing at `/api/anime/seasonal` reads from the D1-backed `seasonal_browse_items` table.
3. The seasonal Sonarr feed at `/api/anime/season-feed` reads from the D1-backed `season_feed_entries` table.
4. Background cron jobs refresh those tables using AniList, MyAnimeList, and Fribb mappings.
5. Create lists and add anime to them.
6. Each list exposes a public URL at `/api/lists/{id}/sonarr`.
7. Paste that URL into **Sonarr -> Import Lists -> Custom List -> List URL**.
8. Sonarr imports the entries using TVDB IDs.

No Sonarr API key is required. Seasonal browsing and season feeds are D1-backed; only `/api/anime/search` fetches AniList live at request time.

Guest users get a session cookie automatically. Username/password accounts are optional if you want lists to persist across devices.

## Project structure

```text
src/
  server/
    index.ts              # Hono app entry point
    db/schema.ts          # Drizzle schema (users, lists, seasonal feed and browse tables)
    lib/
      anilist.ts          # AniList GraphQL client for search and background sync
      anime-mapping.ts    # AniList/MAL to TVDB mapping via Fribb
      sync.ts             # Background seasonal sync into D1
      auth.ts             # Cookie-based session auth
    routes/
      auth.ts             # Register, login, logout, session
      anime.ts            # D1-backed seasonal browse/feed and live AniList search
      lists.ts            # CRUD lists/items and public /sonarr feed
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

The dev server starts at `http://localhost:8787`.

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the local Wrangler dev server |
| `bun run dev:client` | Watch and rebuild the React client |
| `bun run build` | Build the client and run a dry-run deploy |
| `bun run deploy` | Build the client and deploy to Cloudflare |
| `bun run db:generate` | Generate a Drizzle migration from schema changes |
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

Set the required Worker secret:

```bash
bunx wrangler secret put SESSION_SECRET
```

If you use the admin sync endpoint, also set:

```bash
bunx wrangler secret put ADMIN_SYNC_TOKEN
```

## Sonarr feed format

`/api/lists/{id}/sonarr` returns:

```json
[
  { "TvdbId": 418666 },
  { "TvdbId": 75837 }
]
```

This is the format Sonarr expects for a Custom Import List.

