import { drizzle } from "drizzle-orm/d1";
import { seasonFeedSync } from "../db/schema";
import { gqlRequestPage, type AniListMedia } from "./anilist";
import { getAllMALSeasonalAnime } from "./mal";
import {
  batchGetTvdbIds,
  batchGetTvdbIdsFromMal,
  type TvdbLookupCandidate,
} from "./anime-mapping";
import { SEASONS, type Season } from "../../shared/season";

const ANILIST_PER_PAGE = 50;
const BROWSE_PAGE_SIZE = 25;
const RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
type SyncSource = "anilist" | "mal";
type SyncTarget = { season: Season; year: number };
type SyncState = typeof seasonFeedSync.$inferSelect;

export type SyncOptions = {
  season?: Season;
  year?: number;
  force?: boolean;
};

function getSeasonTargets(): SyncTarget[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const currentSeason = SEASONS[Math.floor(now.getUTCMonth() / 3)]!;
  const targets: SyncTarget[] = [{ season: currentSeason, year }];

  for (const season of SEASONS) {
    if (season !== currentSeason) targets.push({ season, year });
  }
  for (const season of SEASONS) {
    targets.push({ season, year: year - 1 });
  }
  return targets;
}


function getState(
  states: ReadonlyMap<string, SyncState>,
  target: SyncTarget,
  source: SyncSource
): SyncState | undefined {
  return states.get(`${target.season}:${target.year}:${source}`);
}

function sourceIsDue(state: SyncState | undefined, now: number): boolean {
  return !state || state.done !== 1 || state.lastSyncedAt === null ||
    now - state.lastSyncedAt >= RESYNC_INTERVAL_MS;
}

function latestAttemptAt(
  states: ReadonlyMap<string, SyncState>,
  target: SyncTarget,
  sources: readonly SyncSource[]
): number {
  return Math.max(0, ...sources.map((source) => getState(states, target, source)?.lastSyncedAt ?? 0));
}

function selectNextTarget(
  targets: readonly SyncTarget[],
  states: ReadonlyMap<string, SyncState>,
  sources: readonly SyncSource[],
  now: number
): SyncTarget | null {
  let selected: SyncTarget | null = null;
  let selectedAttemptAt = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (!sources.some((source) => sourceIsDue(getState(states, target, source), now))) {
      continue;
    }
    const attemptAt = latestAttemptAt(states, target, sources);
    if (attemptAt < selectedAttemptAt) {
      selected = target;
      selectedAttemptAt = attemptAt;
    }
  }
  return selected;
}


async function fetchAniListSeason(target: SyncTarget): Promise<AniListMedia[]> {
  const media: AniListMedia[] = [];
  const seenIds = new Set<number>();
  let page = 1;

  while (true) {
    const result = await gqlRequestPage(
      target.season,
      target.year,
      page,
      ANILIST_PER_PAGE
    );
    for (const item of result.media) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      media.push(item);
    }
    if (!result.pageInfo.hasNextPage) return media;
    if (result.media.length === 0) {
      throw new Error(`AniList returned an empty ${target.season} ${target.year} page while more pages were reported`);
    }
    page++;
  }
}

function browseRows(
  season: Season,
  year: number,
  media: readonly AniListMedia[]
) {
  return media.map((item, sortOrder) => ({
    page: Math.floor(sortOrder / BROWSE_PAGE_SIZE) + 1,
    sortOrder,
    anilistId: item.id,
    titleRomaji: item.title.romaji ?? "",
    titleEnglish: item.title.english ?? null,
    titleNative: item.title.native ?? null,
    coverImageLarge: item.coverImage.large ?? "",
    coverImageMedium: item.coverImage.medium ?? "",
    bannerImage: item.bannerImage ?? null,
    format: item.format ?? "UNKNOWN",
    status: item.status ?? "UNKNOWN",
    episodes: item.episodes ?? null,
    averageScore: item.averageScore ?? null,
    genresJson: JSON.stringify(item.genres),
    description: item.description ?? null,
    seasonValue: item.season ?? season,
    seasonYear: item.seasonYear ?? year,
    startYear: item.startDate.year,
    startMonth: item.startDate.month,
    startDay: item.startDate.day,
    nextAiringAt: item.nextAiringEpisode?.airingAt ?? null,
    nextAiringEpisode: item.nextAiringEpisode?.episode ?? null,
    nextAiringTimeUntil: item.nextAiringEpisode?.timeUntilAiring ?? null,
    studiosJson: JSON.stringify(item.studios.nodes),
  }));
}

const INSERT_BROWSE_ROWS = `
  INSERT INTO seasonal_browse_items (
    season, year, page, sort_order, anilist_id,
    title_romaji, title_english, title_native,
    cover_image_large, cover_image_medium, banner_image,
    format, status, episodes, average_score, genres_json,
    description, season_value, season_year,
    start_year, start_month, start_day,
    next_airing_at, next_airing_episode, next_airing_time_until,
    studios_json, sync_run_at, updated_at
  )
  SELECT
    ?, ?,
    CAST(json_extract(item.value, '$.page') AS INTEGER),
    CAST(json_extract(item.value, '$.sortOrder') AS INTEGER),
    CAST(json_extract(item.value, '$.anilistId') AS INTEGER),
    json_extract(item.value, '$.titleRomaji'),
    json_extract(item.value, '$.titleEnglish'),
    json_extract(item.value, '$.titleNative'),
    json_extract(item.value, '$.coverImageLarge'),
    json_extract(item.value, '$.coverImageMedium'),
    json_extract(item.value, '$.bannerImage'),
    json_extract(item.value, '$.format'),
    json_extract(item.value, '$.status'),
    json_extract(item.value, '$.episodes'),
    json_extract(item.value, '$.averageScore'),
    json_extract(item.value, '$.genresJson'),
    json_extract(item.value, '$.description'),
    json_extract(item.value, '$.seasonValue'),
    json_extract(item.value, '$.seasonYear'),
    json_extract(item.value, '$.startYear'),
    json_extract(item.value, '$.startMonth'),
    json_extract(item.value, '$.startDay'),
    json_extract(item.value, '$.nextAiringAt'),
    json_extract(item.value, '$.nextAiringEpisode'),
    json_extract(item.value, '$.nextAiringTimeUntil'),
    json_extract(item.value, '$.studiosJson'),
    ?, ?
  FROM json_each(?) AS item
`;

function syncStateStatement(
  d1: D1Database,
  target: SyncTarget,
  source: SyncSource,
  syncRunAt: number,
  done: 0 | 1
): D1PreparedStatement {
  return d1.prepare(`
    INSERT INTO season_feed_sync (season, year, source, next_page, done, last_synced_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT (season, year, source) DO UPDATE SET
      next_page = 1,
      done = excluded.done,
      last_synced_at = excluded.last_synced_at
  `).bind(target.season, target.year, source, done, syncRunAt);
}

async function markSyncAttempt(
  d1: D1Database,
  target: SyncTarget,
  source: SyncSource,
  syncRunAt: number
): Promise<void> {
  await d1.batch([syncStateStatement(d1, target, source, syncRunAt, 0)]);
}

async function publishBrowseSnapshot(
  d1: D1Database,
  target: SyncTarget,
  media: readonly AniListMedia[],
  syncRunAt: number
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    d1.prepare(
      "DELETE FROM seasonal_browse_items WHERE season = ? AND year = ?"
    ).bind(target.season, target.year),
  ];
  const rows = browseRows(target.season, target.year, media);
  if (rows.length > 0) {
    statements.push(
      d1.prepare(INSERT_BROWSE_ROWS).bind(
        target.season,
        target.year,
        syncRunAt,
        syncRunAt,
        JSON.stringify(rows)
      )
    );
  }
  statements.push(syncStateStatement(d1, target, "anilist", syncRunAt, 0));
  await d1.batch(statements);
}

async function publishFeedSnapshot(
  d1: D1Database,
  target: SyncTarget,
  source: SyncSource,
  tvdbIds: readonly number[],
  syncRunAt: number
): Promise<void> {
  const uniqueTvdbIds = [...new Set(tvdbIds)];
  const statements: D1PreparedStatement[] = [
    d1.prepare(
      "DELETE FROM season_feed_entries WHERE season = ? AND year = ? AND source = ?"
    ).bind(target.season, target.year, source),
  ];
  if (uniqueTvdbIds.length > 0) {
    statements.push(
      d1.prepare(`
        INSERT INTO season_feed_entries (
          season, year, tvdb_id, source, sync_run_at, updated_at
        )
        SELECT ?, ?, CAST(item.value AS INTEGER), ?, ?, ?
        FROM json_each(?) AS item
      `).bind(
        target.season,
        target.year,
        source,
        syncRunAt,
        syncRunAt,
        JSON.stringify(uniqueTvdbIds)
      )
    );
  }
  statements.push(syncStateStatement(d1, target, source, syncRunAt, 1));
  await d1.batch(statements);
}

function eligibleAniListMedia(media: readonly AniListMedia[]): AniListMedia[] {
  return media.filter((item) =>
    (item.format === "TV" || item.format === "TV_SHORT" || item.format === "ONA") &&
    item.status !== "CANCELLED"
  );
}

function anilistCandidates(media: readonly AniListMedia[]): TvdbLookupCandidate[] {
  return media.map((item) => ({
    id: item.id,
    title: item.title.english ?? item.title.romaji,
    alternateTitles: [item.title.english, item.title.romaji, item.title.native]
      .filter((title): title is string => Boolean(title)),
    ...(item.startDate.year !== null && item.startDate.year > 0
      ? { year: item.startDate.year }
      : {}),
  }));
}

async function syncAniList(
  d1: D1Database,
  target: SyncTarget,
  tvdbApiKey?: string
): Promise<void> {
  const syncRunAt = Date.now();
  let browsePublished = false;
  try {
    const media = await fetchAniListSeason(target);
    await publishBrowseSnapshot(d1, target, media, syncRunAt);
    browsePublished = true;

    const eligibleMedia = eligibleAniListMedia(media);
    const tvdbMap = await batchGetTvdbIds(
      eligibleMedia.map((item) => item.id),
      anilistCandidates(eligibleMedia),
      tvdbApiKey
    );
    await publishFeedSnapshot(
      d1,
      target,
      "anilist",
      [...tvdbMap.values()],
      syncRunAt
    );
  } catch (error) {
    if (!browsePublished) {
      await markSyncAttempt(d1, target, "anilist", syncRunAt);
    }
    throw error;
  }
}

async function syncMAL(
  d1: D1Database,
  target: SyncTarget,
  malClientId: string,
  tvdbApiKey?: string
): Promise<void> {
  const syncRunAt = Date.now();
  try {
    const malMedia = await getAllMALSeasonalAnime(
      target.season,
      target.year,
      malClientId
    );
    const eligibleMedia = malMedia.filter((item) =>
      (item.media_type === "tv" || item.media_type === "ona") &&
      item.nsfw !== "black"
    );
    const malIds = eligibleMedia.map((item) => item.id);
    const candidates = eligibleMedia.flatMap((item) => {
      const startYear = Number(item.start_date?.slice(0, 4));
      return [{
        id: item.id,
        title: item.title,
        ...(Number.isInteger(startYear) && startYear > 0
          ? { year: startYear }
          : {}),
      }];
    });
    const tvdbMap = await batchGetTvdbIdsFromMal(
      malIds,
      candidates,
      tvdbApiKey
    );
    await publishFeedSnapshot(
      d1,
      target,
      "mal",
      [...tvdbMap.values()],
      syncRunAt
    );
  } catch (error) {
    await markSyncAttempt(d1, target, "mal", syncRunAt);
    throw error;
  }
}

function validateOptions(options: SyncOptions | undefined): SyncTarget | null {
  const hasSeason = options?.season !== undefined;
  const hasYear = options?.year !== undefined;
  if (hasSeason !== hasYear) {
    throw new Error("Sync season and year must be provided together");
  }
  if (options?.force && !hasSeason) {
    throw new Error("Forced sync requires a season and year");
  }
  if (!hasSeason || !hasYear) return null;
  if (!SEASONS.includes(options.season!)) {
    throw new Error(`Invalid sync season: ${String(options.season)}`);
  }
  if (!Number.isInteger(options.year) || options.year! < 1) {
    throw new Error(`Invalid sync year: ${String(options.year)}`);
  }
  return { season: options.season!, year: options.year! };
}

export type SyncError = {
  season: string;
  year: number;
  source: SyncSource;
  message: string;
};

export type SyncResult = {
  completed: boolean;
  errors: SyncError[];
  target: SyncTarget | null;
};

export async function runSync(
  d1: D1Database,
  malClientId: string,
  tvdbApiKey?: string,
  options?: SyncOptions
): Promise<SyncResult> {
  const requestedTarget = validateOptions(options);
  const db = drizzle(d1);
  const rows = await db.select().from(seasonFeedSync);
  const states = new Map<string, SyncState>();
  for (const row of rows) {
    if (row.source === "anilist" || row.source === "mal") {
      states.set(`${row.season}:${row.year}:${row.source}`, row);
    }
  }

  const now = Date.now();
  const sources: SyncSource[] = malClientId ? ["anilist", "mal"] : ["anilist"];
  const targets = getSeasonTargets();
  const target = requestedTarget ?? selectNextTarget(targets, states, sources, now);
  if (!target) return { completed: true, errors: [], target: null };

  const force = options?.force === true;
  const errors: SyncError[] = [];
  const anilistState = getState(states, target, "anilist");
  if (force || sourceIsDue(anilistState, now)) {
    try {
      await syncAniList(d1, target, tvdbApiKey);
    } catch (error) {
      errors.push({
        season: target.season,
        year: target.year,
        source: "anilist",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const malState = getState(states, target, "mal");
  if (malClientId && (force || sourceIsDue(malState, now))) {
    try {
      await syncMAL(d1, target, malClientId, tvdbApiKey);
    } catch (error) {
      errors.push({
        season: target.season,
        year: target.year,
        source: "mal",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    completed: errors.length === 0,
    errors,
    target,
  };
}
