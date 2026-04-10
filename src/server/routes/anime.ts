import { Hono } from "hono";
import { getSeasonalAnime, searchAnime } from "../lib/anilist";
import { cachedWithStale } from "../lib/cache";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { seasonFeedEntries } from "../db/schema";

type Env = { Bindings: { DB: D1Database; MAL_CLIENT_ID: string } };

const anime = new Hono<Env>();

anime.get("/seasonal", async (c) => {
  const season = c.req.query("season") ?? getCurrentSeason();
  const year = parseInt(c.req.query("year") ?? String(new Date().getFullYear()));
  const page = parseInt(c.req.query("page") ?? "1");

  const data = await getSeasonalAnime(season, year, page);
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

  // Serve from D1 — always instant, cron keeps it populated
  const sonarrEntries = await cachedWithStale(
    `season-feed:d1:${season}:${year}`,
    300, // 5 min in-memory cache; D1 is source of truth
    async () => {
      const db = drizzle(c.env.DB);
      const rows = await db
        .select({ tvdbId: seasonFeedEntries.tvdbId })
        .from(seasonFeedEntries)
        .where(
          and(
            eq(seasonFeedEntries.season, season),
            eq(seasonFeedEntries.year, year)
          )
        );
      return rows.map((r) => ({ TvdbId: r.tvdbId }));
    }
  );

  c.header("Cache-Control", "public, max-age=300, s-maxage=300");
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
