import { Hono } from "hono";
import { searchAnime } from "../lib/anilist";
import { cachedWithStale } from "../lib/cache";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";
import { seasonalBrowseItems } from "../db/schema";
import type { AppEnv } from "../env";
import { getCurrentSeason, isSeason } from "../../shared/season";


const anime = new Hono<AppEnv>();

function parsePositiveInteger(value: string | undefined, fallback: number): number | null {
  const candidate = value ?? String(fallback);
  if (!/^\d+$/.test(candidate)) return null;

  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

anime.get("/seasonal", async (c) => {
  const season = (c.req.query("season") ?? getCurrentSeason()).toUpperCase();
  const year = parsePositiveInteger(
    c.req.query("year"),
    new Date().getFullYear()
  );
  const page = parsePositiveInteger(c.req.query("page"), 1);

  if (!isSeason(season)) return c.json({ error: "Invalid season" }, 400);
  if (year === null) return c.json({ error: "Invalid year" }, 400);
  if (page === null) return c.json({ error: "Invalid page" }, 400);
  const pageSize = 25;

  const data = await cachedWithStale(
    `seasonal:browse:${season}:${year}:${page}`,
    60,
    async () => {
      const db = drizzle(c.env.DB);
      const rows = await db
        .select()
        .from(seasonalBrowseItems)
        .where(
          and(
            eq(seasonalBrowseItems.season, season),
            eq(seasonalBrowseItems.year, year),
            eq(seasonalBrowseItems.page, page)
          )
        )
        .orderBy(seasonalBrowseItems.sortOrder);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(seasonalBrowseItems)
        .where(
          and(
            eq(seasonalBrowseItems.season, season),
            eq(seasonalBrowseItems.year, year)
          )
        );

      const total = countResult?.count ?? 0;
      const media = rows.map((r) => ({
        id: r.anilistId,
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
    }
  );

  return c.json(data);
});

anime.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Query required" }, 400);

  const page = parsePositiveInteger(c.req.query("page"), 1);
  if (page === null) return c.json({ error: "Invalid page" }, 400);

  const data = await searchAnime(q, page);
  return c.json(data);
});

anime.get("/season-feed", async (c) => {
  const season = (c.req.query("season") ?? getCurrentSeason()).toUpperCase();
  const year = parsePositiveInteger(
    c.req.query("year"),
    new Date().getFullYear()
  );

  if (!isSeason(season)) return c.json({ error: "Invalid season" }, 400);
  if (year === null) return c.json({ error: "Invalid year" }, 400);

  // D1 is source of truth; keep only a tiny cache as a read accelerator.
  const sonarrEntries = await cachedWithStale(
    `season-feed:d1:${season}:${year}`,
    60,
    async () => {
      const db = drizzle(c.env.DB);
      const rows = await db.all<{ tvdb_id: number }>(
        sql`
          SELECT DISTINCT tvdb_id
          FROM season_feed_entries
          WHERE season = ${season}
            AND year = ${year}
          ORDER BY tvdb_id
        `
      );

      return rows.map((row) => ({ TvdbId: Number(row.tvdb_id) }));
    }
  );

  c.header("Cache-Control", "public, max-age=60, s-maxage=60");
  return c.json(sonarrEntries);
});


export default anime;
