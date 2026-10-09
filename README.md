# Sonarr Anime List Builder

Source-available seasonal anime import-list builder for Sonarr. Browse AniList and
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

Guest sessions are automatic and cookie-based. Lists belong to that browser;
there is no account UI or cross-device account sync.

### Seasonal coverage

- `/api/anime/seasonal` merges independent AniList and MAL browse snapshots.
  With `MAL_CLIENT_ID` configured, MAL contributes full card metadata for all
  seasonal formats, including ONA, OVAs, specials, movies, and shorts. MAL can
  refresh browsing even when AniList is blocked. Without that key, browsing
  remains AniList-only.
  Cards expose `source`, source-native `id`, nullable `anilistId`, and nullable
  `malId`; MAL IDs are never presented as AniList IDs. Known cross-provider
  duplicates use Fribb's verified AniList/MAL association, not title text or
  TVDB series IDs. MAL cards take precedence; unmatched AniList cards remain.
- `/api/anime/season-feed` merges TVDB mappings from AniList TV, TV-short, and
  ONA entries with MAL TV and ONA entries. Configure `MAL_CLIENT_ID` to include
  MAL's continuing series; AniList's premiere catalog alone is not a complete
  list of everything airing during the quarter.
- Membership follows each provider's selected season, not status today. Both
  seasonal endpoints accept `includeContinuing=true|false`, defaulting to `true`
  so existing Sonarr imports keep their coverage. MAL's seasonal endpoint
  includes One Piece, Conan, Sazae-san, and Steel Ball Run under the same rule.
  With `false`, entries whose known start year/month precede the selected
  calendar quarter are excluded. Missing year/month is retained unless a known
  year alone proves an earlier premiere; an unknown day does not exclude a title.
  A TVDB series remains if any mapped entry qualifies. The rule applies to both
  browse rows/counts and feeds, without title-specific exceptions.
  AniList uses its `season`/`seasonYear` release assignment; providers may disagree.
  For example, MAL includes Ghost Meets Gal! (September 5) and Link Click III
  (August 14) in Fall 2026 by default; `includeContinuing=false` excludes those
  known earlier premieres. AniList does not assign them to that season.
  Cancelled AniList entries and non-series formats are excluded from the Sonarr
  feed, not from browse cards. MAL requests include gray-rated titles, which its
  default API filter hides; black-rated titles remain excluded.
- Sonarr imports TVDB **series**, so multiple anime seasons can collapse to one
  `TvdbId`. Entries without a verified TVDB series ID cannot be exported.
  `TVDB_API_KEY` enables conservative fallback searches using English, Romaji,
  and native titles, including titles without a known start date. Explicit
  numbered-season suffixes are normalized and searched without a year
  restriction; other dated titles retain their year restriction. Matches must
  have a unique exact normalized title or alias. Ambiguous matches are omitted,
  and no title-specific overrides are maintained.
  Custom-list feeds support both AniList and MAL items, use `TVDB_API_KEY` with
  stored English/original titles as lookup candidates, and deduplicate by TVDB
  series ID. List items do not store premiere dates, so their fallback has no
  year restriction.
  Successful TVDB search responses (including no-match results) are cached for
  six hours through the existing memory/edge cache; API failures are not cached.
- Automatic sync covers the current and previous calendar years, processing one
  due season per invocation. The current season wins initial ties; subsequent
  work selects the oldest attempted due season, so failures cannot starve the
  others. Each selected season fetches every AniList and MAL provider page.
  Successful sources refresh after 24 hours.
- Complete catalog and source-feed snapshots are replaced in atomic D1 batches,
  using bulk JSON inserts instead of one query per title. Failed provider pages
  retain the previous snapshot. TVDB mapping failures retain the previous feed
  but do not prevent complete AniList or MAL browse snapshots from being published.
- Provider failures do not stop the other sources from syncing. The authenticated
  `POST /api/admin/run-sync` returns HTTP 502 with `ok: false` and per-season,
  per-source errors when any source fails; successful selected passes return HTTP
  200. `result.target` identifies the selected season, or is `null` when no
  automatic work is due. Success does not mean all eight seasons ran at once.
  Scheduled sync failures are also propagated to Cloudflare instead of silently
  appearing successful.
- An upstream access block leaves the previous AniList snapshot intact while
  MAL continues refreshing its browse snapshot and Sonarr feed. AniList's
  error remains in sync diagnostics; a MAL refresh does not mean AniList access
  has recovered. Resolve that restriction with AniList rather than bypassing it.
- Browse/feed read caches last 60 seconds and include season, year,
  `includeContinuing`, and browse page. Add `cacheBust=true` to either
  `/api/anime/seasonal` or `/api/anime/season-feed` to read D1 directly with
  `Cache-Control: no-store`.
  The default is `false`; only `true` and `false` are accepted. This bypasses
  read caches, not provider sync freshness.

The self-hosted SQLite adapter exposes asynchronous D1 statement results while
executing batch writes synchronously inside a single SQLite transaction.

### Refreshing stored seasons

The authenticated `POST /api/admin/run-sync?season=FALL&year=2026&force=true`
refreshes that complete season immediately, bypassing the 24-hour freshness
interval. Both `season` and a positive integer `year` are required for a targeted
run; historical years outside the automatic two-year range are also supported.

Apply migration `0005_right_wrecking_crew.sql` before deploying this version
(`bun run db:migrate:remote` for Workers; Bun applies it at local startup).
It preserves existing guest sessions, lists, items, and AniList cards while
adding native MAL identities and continuing membership for feed filtering.
Old unclassified feed entries remain included until refreshed.
Then force a refresh to populate MAL browse snapshots and feed classification,
even if the previous feed-only MAL sync is still within 24 hours.

If AniList remains blocked, the response still reports HTTP 502 and an AniList
source error even when MAL publishes successfully. Inspect `result.errors`
and read `/api/anime/seasonal?season=FALL&year=2026&cacheBust=true` to verify
the recovered catalog; do not treat a partial provider failure as an unblock.

After deployment, refill all eight automatically supported seasons with Bun.
Store `ADMIN_SYNC_TOKEN` in an ignored `.env` file and set `SYNC_BASE_URL` to your
deployment URL; omit it to use the local server:

```bash
SYNC_BASE_URL="https://airing-list-web.edge-5af.workers.dev" bun --env-file=.env -e '
if (!Bun.env.ADMIN_SYNC_TOKEN) throw new Error("ADMIN_SYNC_TOKEN is required");
const base = Bun.env.SYNC_BASE_URL ?? "http://localhost:8787";
const year = new Date().getUTCFullYear();
for (const y of [year, year - 1]) {
  for (const season of ["WINTER", "SPRING", "SUMMER", "FALL"]) {
    const response = await fetch(`${base}/api/admin/run-sync?season=${season}&year=${y}&force=true`, {
      method: "POST",
      headers: { authorization: `Bearer ${Bun.env.ADMIN_SYNC_TOKEN}` },
    });
    console.log(y, season, response.status, await response.json());
    if (!response.ok) process.exitCode = 1;
  }
}
'
```

The feed can contain fewer entries than the catalog: movies and other
non-series formats are excluded, unmapped series need authoritative mappings
or a successful TVDB lookup, and multiple provider entries can share one ID.
Large TVDB fallback passes can exceed
[Worker Free's 50-subrequest limit](https://developers.cloudflare.com/workers/platform/limits/#subrequests);
use a runtime or plan with sufficient request capacity. A lookup failure is
reported rather than replacing the feed with an incomplete result.


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
| `bun run typecheck` | Type-check the browser, Worker, and Bun/tooling |
| `bun run build:client` | Build the React client |
| `bunx wrangler deploy --dry-run` | Build the Worker without deploying |
| `bun run build` | Run all validation and both production builds |
| `bun run deploy` | Validate, build, and deploy to Cloudflare |
| `bun run db:check` | Validate Drizzle migration journal and snapshots |
| `bun run db:generate` | Generate a Drizzle migration |
| `bun run db:migrate:local` | Apply migrations to local D1 |
| `bun run db:migrate:remote` | Apply migrations to production D1 |
| `bun run db:studio` | Open Drizzle Studio |

There is no permanent test suite. Verify changed behavior through the actual
Bun or `workerd` runtime and check the affected API responses and browser
surface. Remove throwaway smoke scripts after verification.

The authored schema lives in `src/server/db/schema.ts`; generated SQL, snapshots,
and the journal live together in the conventional root `drizzle/` directory.
Commit those generated artifacts together and never edit a migration that has
already been applied. Create a new migration for every subsequent schema change.

Run each validation step independently:

```bash
bun run db:check
bun run typecheck
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

## License and AI use

Copyright © 2026 Shivam Bansal and contributors. See [LICENSE](LICENSE) for the
**Airing List No-Training Attribution License 1.0**, a custom source-available
license, not the MIT License or an OSI-approved open-source license.

- Use, modification, self-hosting, and redistribution are allowed under the
  license's attribution requirements. Retain the license, author/contributor
  notices, project name, and source URL. Publicly distributed or hosted modified
  versions must credit the project in their README, documentation, or credits.
- Automated harvesting for training, model training, fine-tuning, distillation,
  and supplying derived training datasets require separate prior written
  permission. This applies to commercial, noncommercial, and open-weight models.
- Separately authorized training must acknowledge the project and its authors in
  the relevant dataset and model documentation. Attribution alone is not permission.
- AI-assisted coding, review, indexing, and pull requests are welcome when the
  repository material, prompts, responses, and patches are not used for training.
- Third-party libraries, artwork, and metadata retain their own terms. Existing
  rights previously granted under other licenses are not revoked.

The license and [agent instructions](AGENTS.md) are legal and policy notices,
not a technical scraper block. Copyright exceptions and enforceability depend
on applicable law; obtain legal review before relying on these custom terms.
Research reference: [Non-AI license templates](https://github.com/non-ai-licenses/non-ai-licenses).
