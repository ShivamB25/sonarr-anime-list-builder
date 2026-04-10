import { Hono } from "hono";
import { getSeasonalAnime, searchAnime } from "../lib/anilist";
import { batchGetTvdbIds } from "../lib/anime-mapping";
import { cachedWithStale } from "../lib/cache";

type Env = { Bindings: { DB: D1Database } };

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

  const sonarrEntries = await cachedWithStale(
    `season-feed:${season}:${year}`,
    3600,
    async () => {
      const data = await getSeasonalAnime(season, year, 1, 100);
      const anilistIds = data.media.map((m) => m.id);
      const tvdbMap = await batchGetTvdbIds(anilistIds);

      const entries: { TvdbId: number }[] = [];
      for (const id of anilistIds) {
        const tvdbId = tvdbMap.get(id);
        if (tvdbId) entries.push({ TvdbId: tvdbId });
      }
      return entries;
    }
  );

  c.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
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
