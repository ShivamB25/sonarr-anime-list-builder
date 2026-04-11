import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { seasonFeedEntries, seasonFeedSync, seasonalBrowseItems } from "../db/schema";
import { gqlRequestPage } from "./anilist";
import { getAllMALSeasonalAnime } from "./mal";
import { batchGetTvdbIds, batchGetTvdbIdsFromMal } from "./anime-mapping";

const ANILIST_PER_PAGE = 50;
const BROWSE_PAGE_SIZE = 25;
// Reset done=0 after 24h so each season re-syncs daily
const RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

function getSeasonTargets(): { season: string; year: number }[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  let currentSeason: string;
  if (month <= 3) currentSeason = "WINTER";
  else if (month <= 6) currentSeason = "SPRING";
  else if (month <= 9) currentSeason = "SUMMER";
  else currentSeason = "FALL";

  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const targets: { season: string; year: number }[] = [];

  // Current season first, then all of current year, then previous year
  targets.push({ season: currentSeason, year });
  for (const s of seasons) {
    if (s !== currentSeason) targets.push({ season: s, year });
  }
  for (const s of seasons) {
    targets.push({ season: s, year: year - 1 });
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
  // D1 supports up to 100 params per statement; batch in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < tvdbIds.length; i += chunkSize) {
    const chunk = tvdbIds.slice(i, i + chunkSize);
    await db
      .insert(seasonFeedEntries)
      .values(
        chunk.map((id) => ({
          season,
          year,
          tvdbId: id,
          source,
          syncRunAt,
          updatedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: [
          seasonFeedEntries.season,
          seasonFeedEntries.year,
          seasonFeedEntries.source,
          seasonFeedEntries.tvdbId,
        ],
        set: { syncRunAt, updatedAt: now },
      });
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
    nextAiringEpisode: {
      airingAt: number;
      episode: number;
      timeUntilAiring: number;
    } | null;
    startDate: { year: number; month: number; day: number };
    studios: { nodes: { name: string }[] };
  }[]
): Promise<void> {
  if (media.length === 0) return;
  const now = Date.now();
  const chunkSize = 25;

  for (let i = 0; i < media.length; i += chunkSize) {
    const chunk = media.slice(i, i + chunkSize);
    await db
      .insert(seasonalBrowseItems)
      .values(
        chunk.map((m, idx) => {
          const sortOrder = i + idx;
          return {
            season,
            year,
            page: Math.floor(sortOrder / BROWSE_PAGE_SIZE) + 1,
            sortOrder,
            anilistId: m.id,
            titleRomaji: m.title.romaji,
            titleEnglish: m.title.english,
            titleNative: m.title.native,
            coverImageLarge: m.coverImage.large,
            coverImageMedium: m.coverImage.medium,
            bannerImage: m.bannerImage,
            format: m.format,
            status: m.status,
            episodes: m.episodes,
            averageScore: m.averageScore,
            genresJson: JSON.stringify(m.genres),
            description: m.description,
            seasonValue: m.season,
            seasonYear: m.seasonYear,
            startYear: m.startDate.year,
            startMonth: m.startDate.month,
            startDay: m.startDate.day,
            nextAiringAt: m.nextAiringEpisode?.airingAt ?? null,
            nextAiringEpisode: m.nextAiringEpisode?.episode ?? null,
            nextAiringTimeUntil: m.nextAiringEpisode?.timeUntilAiring ?? null,
            studiosJson: JSON.stringify(m.studios.nodes),
            syncRunAt,
            updatedAt: now,
          };
        })
      )
      .onConflictDoUpdate({
        target: [
          seasonalBrowseItems.season,
          seasonalBrowseItems.year,
          seasonalBrowseItems.anilistId,
        ],
        set: {
          page: sql`excluded.page`,
          sortOrder: sql`excluded.sort_order`,
          titleRomaji: sql`excluded.title_romaji`,
          titleEnglish: sql`excluded.title_english`,
          titleNative: sql`excluded.title_native`,
          coverImageLarge: sql`excluded.cover_image_large`,
          coverImageMedium: sql`excluded.cover_image_medium`,
          bannerImage: sql`excluded.banner_image`,
          format: sql`excluded.format`,
          status: sql`excluded.status`,
          episodes: sql`excluded.episodes`,
          averageScore: sql`excluded.average_score`,
          genresJson: sql`excluded.genres_json`,
          description: sql`excluded.description`,
          seasonValue: sql`excluded.season_value`,
          seasonYear: sql`excluded.season_year`,
          startYear: sql`excluded.start_year`,
          startMonth: sql`excluded.start_month`,
          startDay: sql`excluded.start_day`,
          nextAiringAt: sql`excluded.next_airing_at`,
          nextAiringEpisode: sql`excluded.next_airing_episode`,
          nextAiringTimeUntil: sql`excluded.next_airing_time_until`,
          studiosJson: sql`excluded.studios_json`,
          syncRunAt,
          updatedAt: now,
        },
      });
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
  year: number
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
  const syncRunAt = state.done === 0 && page > 1 ? state.lastSyncedAt ?? Date.now() : Date.now();
  const data = await gqlRequestPage(season, year, page, ANILIST_PER_PAGE);
  await upsertBrowseItems(db, season, year, syncRunAt, data.media);
  const anilistIds = data.media.map((m: { id: number }) => m.id);
  const tvdbMap = await batchGetTvdbIds(anilistIds);
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
  malClientId: string
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
  const malIds = malMedia.map((m) => m.id);
  const tvdbMap = await batchGetTvdbIdsFromMal(malIds);
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

export async function runSync(
  d1: D1Database,
  malClientId: string
): Promise<void> {
  const db = drizzle(d1);
  const targets = getSeasonTargets();

  for (const { season, year } of targets) {
    // AniList: one page per cron tick per season
    try {
      await syncAnilistPage(db, season, year);
    } catch {
      // skip this season's anilist page, try next season
    }

    // MAL: full fetch per season (single request, 500 limit)
    if (malClientId) {
      try {
        await syncMAL(db, season, year, malClientId);
      } catch {
        // skip this season's mal sync
      }
    }
  }
}
