import { Hono } from "hono";
import { searchAnime } from "../lib/anilist";
import { cachedWithStale } from "../lib/cache";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { seasonFeedEntries, seasonalBrowseItems } from "../db/schema";

type Env = { Bindings: { DB: D1Database; MAL_CLIENT_ID: string } };

const anime = new Hono<Env>();

anime.get("/seasonal", async (c) => {
  const season = (c.req.query("season") ?? getCurrentSeason()).toUpperCase();
  const year = parseInt(c.req.query("year") ?? String(new Date().getFullYear()));
  const page = parseInt(c.req.query("page") ?? "1");
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

      const countResult = await db.run(
        sql`
          SELECT COUNT(*) as count
          FROM seasonal_browse_items
          WHERE season = ${season}
            AND year = ${year}
        `
      );

      const total = Number(countResult.results[0]?.count ?? 0);
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

  const page = parseInt(c.req.query("page") ?? "1");
  const data = await searchAnime(q, page);
  return c.json(data);
});

anime.get("/season-feed", async (c) => {
  const season = (c.req.query("season") ?? getCurrentSeason()).toUpperCase();
  const year = parseInt(
    c.req.query("year") ?? String(new Date().getFullYear())
  );

  // D1 is source of truth; keep only a tiny cache as a read accelerator.
  const sonarrEntries = await cachedWithStale(
    `season-feed:d1:${season}:${year}`,
    60,
    async () => {
      const db = drizzle(c.env.DB);
      const rows = await db.run(
        sql`
          SELECT DISTINCT tvdb_id
          FROM season_feed_entries
          WHERE season = ${season}
            AND year = ${year}
          ORDER BY tvdb_id
        `
      );

      return rows.results.map((r) => ({ TvdbId: Number(r.tvdb_id) }));
    }
  );

  c.header("Cache-Control", "public, max-age=60, s-maxage=60");
  return c.json(sonarrEntries);
});

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 1 && month <= 3) return "WINTER";
  if (month >= 4 && month <= 6) return "SPRING";
  if (month >= 7 && month <= 9) return "SUMMER";
  return "FALL";
}

export default anime;
