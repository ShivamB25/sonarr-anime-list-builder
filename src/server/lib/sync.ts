import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { seasonFeedEntries, seasonFeedSync } from "../db/schema";
import { gqlRequestPage } from "./anilist";
import { getAllMALSeasonalAnime } from "./mal";
import { batchGetTvdbIds, batchGetTvdbIdsFromMal } from "./anime-mapping";

const ANILIST_PER_PAGE = 50;
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
      .values(chunk.map((id) => ({ season, year, tvdbId: id, source, updatedAt: now })))
      .onConflictDoUpdate({
        target: [seasonFeedEntries.season, seasonFeedEntries.year, seasonFeedEntries.tvdbId],
        set: { source, updatedAt: now },
      });
  }
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
  const data = await gqlRequestPage(season, year, page, ANILIST_PER_PAGE);
  const anilistIds = data.media.map((m: { id: number }) => m.id);
  const tvdbMap = await batchGetTvdbIds(anilistIds);
  await upsertTvdbIds(db, season, year, "anilist", Array.from(tvdbMap.values()));

  const isDone = !data.pageInfo.hasNextPage || data.media.length === 0;
  await db
    .update(seasonFeedSync)
    .set({
      nextPage: isDone ? 1 : page + 1,
      done: isDone ? 1 : 0,
      lastSyncedAt: Date.now(),
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
  const malMedia = await getAllMALSeasonalAnime(season, year, malClientId);
  const malIds = malMedia.map((m) => m.id);
  const tvdbMap = await batchGetTvdbIdsFromMal(malIds);
  await upsertTvdbIds(db, season, year, "mal", Array.from(tvdbMap.values()));

  await db
    .update(seasonFeedSync)
    .set({ done: 1, nextPage: 1, lastSyncedAt: Date.now() })
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
