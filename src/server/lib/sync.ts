import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { seasonFeedEntries, seasonFeedSync, seasonalBrowseItems } from "../db/schema";
import { gqlRequestPage, type AniListMedia } from "./anilist";
import { getAllMALSeasonalAnime, type MALAnime } from "./mal";
import { batchGetTvdbIds, batchGetTvdbIdsFromMal } from "./anime-mapping";
import { SEASONS, type Season } from "../../shared/season";

const ANILIST_PER_PAGE = 50;
const BROWSE_PAGE_SIZE = 25;
// Reset done=0 after 24h so each season re-syncs daily
const RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TV_LIKE_ANILIST_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
const TV_LIKE_MAL_MEDIA_TYPES = new Set(["tv", "ona"]);
// Allow shows that started within this many years before the target year (covers multi-cour carryovers)
const START_YEAR_LOOKBACK = 2;

function isSeasonFeedAniListEntry(
  media: AniListMedia,
  year: number
): boolean {
  if (!TV_LIKE_ANILIST_FORMATS.has(media.format)) return false;
  if (media.status !== "RELEASING" && media.status !== "NOT_YET_RELEASED") return false;
  const startYear = media.startDate.year;
  return !!startYear && startYear >= year - START_YEAR_LOOKBACK;
}

function isSeasonFeedMALEntry(media: MALAnime, year: number): boolean {
  if (!media.start_date || !TV_LIKE_MAL_MEDIA_TYPES.has(media.media_type ?? "")) return false;
  if (media.status !== "currently_airing" && media.status !== "not_yet_aired") return false;
  const startYear = parseInt(media.start_date.split("-")[0], 10);
  return startYear >= year - START_YEAR_LOOKBACK;
}

function getSeasonTargets(): { season: Season; year: number }[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const currentSeason = SEASONS[Math.floor(now.getUTCMonth() / 3)]!;
  const targets: { season: Season; year: number }[] = [];

  // Current season first, then all of current year, then previous year
  targets.push({ season: currentSeason, year });
  for (const season of SEASONS) {
    if (season !== currentSeason) targets.push({ season, year });
  }
  for (const season of SEASONS) {
    targets.push({ season, year: year - 1 });
  }
  return targets;
}

async function upsertTvdbIds(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  source: string,
  syncRunAt: number,
  tvdbIds: number[]
): Promise<void> {
  if (tvdbIds.length === 0) return;
  const now = Date.now();
  // Insert one row at a time to stay safely within D1's SQL variable limit
  for (const tvdbId of tvdbIds) {
    await db.run(sql`
      INSERT INTO season_feed_entries (season, year, tvdb_id, source, sync_run_at, updated_at)
      VALUES (${season}, ${year}, ${tvdbId}, ${source}, ${syncRunAt}, ${now})
      ON CONFLICT (season, year, source, tvdb_id) DO UPDATE SET
        sync_run_at = excluded.sync_run_at,
        updated_at = excluded.updated_at
    `);
  }
}

async function cleanupSourceRows(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  source: string,
  syncRunAt: number
): Promise<void> {
  await db.run(
    sql`
      DELETE FROM season_feed_entries
      WHERE season = ${season}
        AND year = ${year}
        AND source = ${source}
        AND sync_run_at <> ${syncRunAt}
    `
  );
}

async function upsertBrowseItem(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  syncRunAt: number,
  m: {
    id: number;
    title: { romaji: string; english: string | null; native: string | null };
    coverImage: { large: string; medium: string };
    bannerImage: string | null;
    format: string;
    status: string;
    episodes: number | null;
    averageScore: number | null;
    genres: string[];
    season: string;
    seasonYear: number;
    description: string | null;
    nextAiringEpisode: { airingAt: number; episode: number; timeUntilAiring: number } | null;
    startDate: { year: number; month: number; day: number };
    studios: { nodes: { name: string }[] };
  },
  sortOrder: number
): Promise<void> {
  const now = Date.now();
  const page = Math.floor(sortOrder / BROWSE_PAGE_SIZE) + 1;
  await db.run(sql`
    INSERT INTO seasonal_browse_items (
      season, year, page, sort_order, anilist_id,
      title_romaji, title_english, title_native,
      cover_image_large, cover_image_medium, banner_image,
      format, status, episodes, average_score, genres_json,
      description, season_value, season_year,
      start_year, start_month, start_day,
      next_airing_at, next_airing_episode, next_airing_time_until,
      studios_json, sync_run_at, updated_at
    ) VALUES (
      ${season}, ${year}, ${page}, ${sortOrder}, ${m.id},
      ${m.title.romaji ?? ""}, ${m.title.english ?? null}, ${m.title.native ?? null},
      ${m.coverImage.large ?? ""}, ${m.coverImage.medium ?? ""}, ${m.bannerImage ?? null},
      ${m.format ?? "UNKNOWN"}, ${m.status ?? "UNKNOWN"}, ${m.episodes ?? null}, ${m.averageScore ?? null}, ${JSON.stringify(m.genres)},
      ${m.description ?? null}, ${m.season ?? season}, ${m.seasonYear ?? year},
      ${m.startDate.year}, ${m.startDate.month}, ${m.startDate.day},
      ${m.nextAiringEpisode?.airingAt ?? null}, ${m.nextAiringEpisode?.episode ?? null}, ${m.nextAiringEpisode?.timeUntilAiring ?? null},
      ${JSON.stringify(m.studios.nodes)}, ${syncRunAt}, ${now}
    )
    ON CONFLICT (season, year, anilist_id) DO UPDATE SET
      page = excluded.page,
      sort_order = excluded.sort_order,
      title_romaji = excluded.title_romaji,
      title_english = excluded.title_english,
      title_native = excluded.title_native,
      cover_image_large = excluded.cover_image_large,
      cover_image_medium = excluded.cover_image_medium,
      banner_image = excluded.banner_image,
      format = excluded.format,
      status = excluded.status,
      episodes = excluded.episodes,
      average_score = excluded.average_score,
      genres_json = excluded.genres_json,
      description = excluded.description,
      season_value = excluded.season_value,
      season_year = excluded.season_year,
      start_year = excluded.start_year,
      start_month = excluded.start_month,
      start_day = excluded.start_day,
      next_airing_at = excluded.next_airing_at,
      next_airing_episode = excluded.next_airing_episode,
      next_airing_time_until = excluded.next_airing_time_until,
      studios_json = excluded.studios_json,
      sync_run_at = excluded.sync_run_at,
      updated_at = excluded.updated_at
  `);
}

async function upsertBrowseItems(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  syncRunAt: number,
  media: {
    id: number;
    title: { romaji: string; english: string | null; native: string | null };
    coverImage: { large: string; medium: string };
    bannerImage: string | null;
    format: string;
    status: string;
    episodes: number | null;
    averageScore: number | null;
    genres: string[];
    season: string;
    seasonYear: number;
    description: string | null;
    nextAiringEpisode: { airingAt: number; episode: number; timeUntilAiring: number } | null;
    startDate: { year: number; month: number; day: number };
    studios: { nodes: { name: string }[] };
  }[]
): Promise<void> {
  for (let i = 0; i < media.length; i++) {
    await upsertBrowseItem(db, season, year, syncRunAt, media[i], i);
  }
}

async function cleanupBrowseRows(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  syncRunAt: number
): Promise<void> {
  await db.run(
    sql`
      DELETE FROM seasonal_browse_items
      WHERE season = ${season}
        AND year = ${year}
        AND sync_run_at <> ${syncRunAt}
    `
  );
}

async function getSyncState(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  source: string
) {
  const rows = await db
    .select()
    .from(seasonFeedSync)
    .where(
      and(
        eq(seasonFeedSync.season, season),
        eq(seasonFeedSync.year, year),
        eq(seasonFeedSync.source, source)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function ensureSyncRow(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  source: string
) {
  await db
    .insert(seasonFeedSync)
    .values({ season, year, source, nextPage: 1, done: 0, lastSyncedAt: null })
    .onConflictDoNothing();
}

async function syncAnilistPage(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  tvdbApiKey?: string
): Promise<void> {
  await ensureSyncRow(db, season, year, "anilist");
  const state = await getSyncState(db, season, year, "anilist");
  if (!state) return;

  // Reset if done and enough time has passed
  if (state.done === 1) {
    const age = Date.now() - (state.lastSyncedAt ?? 0);
    if (age < RESYNC_INTERVAL_MS) return;
    await db
      .update(seasonFeedSync)
      .set({ done: 0, nextPage: 1 })
      .where(
        and(
          eq(seasonFeedSync.season, season),
          eq(seasonFeedSync.year, year),
          eq(seasonFeedSync.source, "anilist")
        )
      );
    state.nextPage = 1;
    state.done = 0;
  }

  const page = state.nextPage;
  const syncRunAt = state.lastSyncedAt ?? Date.now();
  const data = await gqlRequestPage(season, year, page, ANILIST_PER_PAGE);
  await upsertBrowseItems(db, season, year, syncRunAt, data.media);
  const eligibleMedia = data.media.filter((media: AniListMedia) =>
    isSeasonFeedAniListEntry(media, year)
  );
  const anilistIds = eligibleMedia.map((media: AniListMedia) => media.id);
  const tvdbMap = await batchGetTvdbIds(
    anilistIds,
    eligibleMedia.map((media: AniListMedia) => ({
      id: media.id,
      title: media.title.english ?? media.title.romaji,
      year: media.startDate.year,
    })),
    tvdbApiKey
  );
  await upsertTvdbIds(
    db,
    season,
    year,
    "anilist",
    syncRunAt,
    Array.from(tvdbMap.values())
  );

  const isDone = !data.pageInfo.hasNextPage || data.media.length === 0;
  if (isDone) {
    await cleanupSourceRows(db, season, year, "anilist", syncRunAt);
    await cleanupBrowseRows(db, season, year, syncRunAt);
  }
  await db
    .update(seasonFeedSync)
    .set({
      nextPage: isDone ? 1 : page + 1,
      done: isDone ? 1 : 0,
      lastSyncedAt: syncRunAt,
    })
    .where(
      and(
        eq(seasonFeedSync.season, season),
        eq(seasonFeedSync.year, year),
        eq(seasonFeedSync.source, "anilist")
      )
    );
}

async function syncMAL(
  db: ReturnType<typeof drizzle>,
  season: string,
  year: number,
  malClientId: string,
  tvdbApiKey?: string
): Promise<void> {
  await ensureSyncRow(db, season, year, "mal");
  const state = await getSyncState(db, season, year, "mal");
  if (!state) return;

  if (state.done === 1) {
    const age = Date.now() - (state.lastSyncedAt ?? 0);
    if (age < RESYNC_INTERVAL_MS) return;
    await db
      .update(seasonFeedSync)
      .set({ done: 0, nextPage: 1 })
      .where(
        and(
          eq(seasonFeedSync.season, season),
          eq(seasonFeedSync.year, year),
          eq(seasonFeedSync.source, "mal")
        )
      );
  }

  // MAL fetches everything in one call (limit 500), so always mark done after one sync
  const syncRunAt = Date.now();
  const malMedia = await getAllMALSeasonalAnime(season, year, malClientId);
  const eligibleMedia = malMedia.filter((media) => isSeasonFeedMALEntry(media, year));
  const malIds = eligibleMedia.map((media) => media.id);
  const tvdbMap = await batchGetTvdbIdsFromMal(
    malIds,
    eligibleMedia.map((media) => ({
      id: media.id,
      title: media.title,
      year: Number(media.start_date!.slice(0, 4)),
    })),
    tvdbApiKey
  );
  await upsertTvdbIds(db, season, year, "mal", syncRunAt, Array.from(tvdbMap.values()));
  await cleanupSourceRows(db, season, year, "mal", syncRunAt);

  await db
    .update(seasonFeedSync)
    .set({ done: 1, nextPage: 1, lastSyncedAt: syncRunAt })
    .where(
      and(
        eq(seasonFeedSync.season, season),
        eq(seasonFeedSync.year, year),
        eq(seasonFeedSync.source, "mal")
      )
    );
}

export type SyncError = {
  season: string;
  year: number;
  source: "anilist" | "mal";
  message: string;
};

export type SyncResult = {
  completed: boolean;
  errors: SyncError[];
};

export async function runSync(
  d1: D1Database,
  malClientId: string,
  tvdbApiKey?: string,
  failFast = false
): Promise<SyncResult> {
  const db = drizzle(d1);
  const targets = getSeasonTargets();
  const errors: SyncError[] = [];

  for (const { season, year } of targets) {
    try {
      await syncAnilistPage(db, season, year, tvdbApiKey);
    } catch (error) {
      const syncError = {
        season,
        year,
        source: "anilist" as const,
        message: error instanceof Error ? error.message : String(error),
      };
      if (failFast) {
        throw new Error(
          `[${syncError.source}] ${syncError.season} ${syncError.year}: ${syncError.message}`
        );
      }
      errors.push(syncError);
    }

    if (malClientId) {
      try {
        await syncMAL(db, season, year, malClientId, tvdbApiKey);
      } catch (error) {
        const syncError = {
          season,
          year,
          source: "mal" as const,
          message: error instanceof Error ? error.message : String(error),
        };
        if (failFast) {
          throw new Error(
            `[${syncError.source}] ${syncError.season} ${syncError.year}: ${syncError.message}`
          );
        }
        errors.push(syncError);
      }
    }
  }

  return {
    completed: errors.length === 0,
    errors,
  };
}
