import { Hono } from "hono";
import { searchAnime } from "../lib/anilist";
import { cachedWithStale } from "../lib/cache";
import { drizzle } from "drizzle-orm/d1";
import { sql, type SQL } from "drizzle-orm";
import { seasonalBrowseItems } from "../db/schema";
import type { AppEnv } from "../env";
import { getCurrentSeason, isSeason, SEASONS, type Season } from "../../shared/season";


const anime = new Hono<AppEnv>();

function parsePositiveInteger(value: string | undefined, fallback: number): number | null {
  const candidate = value ?? String(fallback);
  if (!/^\d+$/.test(candidate)) return null;

  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean | null {
  if (value === undefined) return fallback;
  if (value === "false") return false;
  if (value === "true") return true;
  return null;
}

function notBeforeSeason(startYear: SQL, startMonth: SQL, season: Season, year: number): SQL {
  const firstMonth = SEASONS.indexOf(season) * 3 + 1;
  return sql`(
    ${startYear} IS NULL OR ${startYear} <= 0 OR ${startYear} > ${year}
    OR (${startYear} = ${year} AND (
      ${startMonth} IS NULL OR ${startMonth} <= 0 OR ${startMonth} >= ${firstMonth}
    ))
  )`;
}

anime.get("/seasonal", async (c) => {
  const season = (c.req.query("season") ?? getCurrentSeason()).toUpperCase();
  const year = parsePositiveInteger(
    c.req.query("year"),
    new Date().getFullYear()
  );
  const page = parsePositiveInteger(c.req.query("page"), 1);
  const cacheBust = parseBoolean(c.req.query("cacheBust"), false);
  const includeContinuing = parseBoolean(c.req.query("includeContinuing"), true);

  if (!isSeason(season)) return c.json({ error: "Invalid season" }, 400);
  if (year === null) return c.json({ error: "Invalid year" }, 400);
  if (page === null) return c.json({ error: "Invalid page" }, 400);
  if (cacheBust === null) return c.json({ error: "Invalid cacheBust" }, 400);
  if (includeContinuing === null) return c.json({ error: "Invalid includeContinuing" }, 400);
  const pageSize = 25;

  const fetchSeasonalPage = async () => {
    const db = drizzle(c.env.DB);
    const dateFilter = includeContinuing ? sql`1 = 1` : notBeforeSeason(
      sql`${seasonalBrowseItems.startYear}`, sql`${seasonalBrowseItems.startMonth}`, season, year
    );
    const malDateFilter = includeContinuing ? sql`1 = 1` : notBeforeSeason(
      sql`mal.start_year`, sql`mal.start_month`, season, year
    );
    const mergedWhere = sql`
      ${seasonalBrowseItems.season} = ${season}
      AND ${seasonalBrowseItems.year} = ${year}
      AND ${seasonalBrowseItems.format} IN ('TV', 'TV_SHORT', 'ONA')
      AND ${dateFilter}
      AND (
        ${seasonalBrowseItems.source} != 'anilist'
        OR ${seasonalBrowseItems.anilistId} IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM seasonal_browse_items AS mal
          WHERE mal.season = ${seasonalBrowseItems.season}
            AND mal.year = ${seasonalBrowseItems.year}
            AND mal.source = 'mal'
            AND mal.format IN ('TV', 'TV_SHORT', 'ONA')
            AND mal.anilist_id = ${seasonalBrowseItems.anilistId}
            AND ${malDateFilter}
        )
      )
    `;
    const rows = await db
      .select()
      .from(seasonalBrowseItems)
      .where(mergedWhere)
      .orderBy(
        seasonalBrowseItems.sortOrder,
        seasonalBrowseItems.source,
        seasonalBrowseItems.sourceId
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(seasonalBrowseItems)
      .where(mergedWhere);

    const total = countResult?.count ?? 0;
    const media = rows.map((r) => ({
      source: r.source,
      id: r.sourceId,
      anilistId: r.anilistId,
      malId: r.malId,
      title: {
        romaji: r.titleRomaji,
        english: r.titleEnglish,
        native: r.titleNative,
      },
      coverImage: {
        large: r.coverImageLarge,
        medium: r.coverImageMedium,
      },
      bannerImage: r.bannerImage,
      format: r.format,
      status: r.status,
      episodes: r.episodes,
      averageScore: r.averageScore,
      genres: JSON.parse(r.genresJson) as string[],
      season: r.seasonValue,
      seasonYear: r.seasonYear,
      description: r.description,
      nextAiringEpisode: r.nextAiringAt
        ? {
            airingAt: r.nextAiringAt,
            episode: r.nextAiringEpisode!,
            timeUntilAiring: r.nextAiringTimeUntil!,
          }
        : null,
      startDate: {
        year: r.startYear,
        month: r.startMonth,
        day: r.startDay,
      },
      studios: {
        nodes: JSON.parse(r.studiosJson) as { name: string }[],
      },
    }));

    return {
      pageInfo: {
        hasNextPage: page * pageSize < total,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(total / pageSize)),
        total,
      },
      media,
    };
  };
  const data = cacheBust
    ? await fetchSeasonalPage()
    : await cachedWithStale(
        `seasonal:browse:v4:${season}:${year}:${page}:${includeContinuing}`,
        60,
        fetchSeasonalPage
      );

  if (cacheBust) c.header("Cache-Control", "no-store");
  return c.json(data);
});


anime.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Query required" }, 400);

  const page = parsePositiveInteger(c.req.query("page"), 1);
  if (page === null) return c.json({ error: "Invalid page" }, 400);

  const data = await searchAnime(q, page);
  return c.json({
    ...data,
    media: data.media.map((media) => ({
      ...media,
      source: "anilist" as const,
      id: media.id,
      anilistId: media.id,
      malId: null,
    })),
  });
});


anime.get("/season-feed", async (c) => {
  const season = (c.req.query("season") ?? getCurrentSeason()).toUpperCase();
  const year = parsePositiveInteger(
    c.req.query("year"),
    new Date().getFullYear()
  );
  const cacheBust = parseBoolean(c.req.query("cacheBust"), false);
  const includeContinuing = parseBoolean(c.req.query("includeContinuing"), true);

  if (!isSeason(season)) return c.json({ error: "Invalid season" }, 400);
  if (year === null) return c.json({ error: "Invalid year" }, 400);
  if (cacheBust === null) return c.json({ error: "Invalid cacheBust" }, 400);
  if (includeContinuing === null) return c.json({ error: "Invalid includeContinuing" }, 400);

  // D1 is source of truth; keep only a tiny cache as a read accelerator.
  const fetchSeasonFeed = async () => {
    const db = drizzle(c.env.DB);
    const rows = await db.all<{ tvdb_id: number }>(
      sql`
        SELECT DISTINCT tvdb_id
        FROM season_feed_entries
        WHERE season = ${season}
          AND year = ${year}
          AND (${includeContinuing ? 1 : 0} = 1 OR is_continuing = 0)
        ORDER BY tvdb_id
      `
    );

    return rows.map((row) => ({ TvdbId: Number(row.tvdb_id) }));
  };
  const sonarrEntries = cacheBust
    ? await fetchSeasonFeed()
    : await cachedWithStale(
        `season-feed:d1:v2:${season}:${year}:${includeContinuing}`,
        60,
        fetchSeasonFeed
      );

  c.header(
    "Cache-Control",
    cacheBust ? "no-store" : "public, max-age=60, s-maxage=60"
  );
  return c.json(sonarrEntries);
});


export default anime;
