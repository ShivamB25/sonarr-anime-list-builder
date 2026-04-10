import { Hono } from "hono";
import { getSeasonalAnime, getAllSeasonalAnime, searchAnime } from "../lib/anilist";
import { getAllMALSeasonalAnime } from "../lib/mal";
import { batchGetTvdbIds, batchGetTvdbIdsFromMal } from "../lib/anime-mapping";
import { cachedWithStale } from "../lib/cache";

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

  const malClientId = c.env.MAL_CLIENT_ID;

  const sonarrEntries = await cachedWithStale(
    `season-feed:v3:${season}:${year}`,
    3600,
    async () => {
      const tvdbIds = new Set<number>();

      // AniList source
      try {
        const anilistMedia = await getAllSeasonalAnime(season, year);
        const anilistIds = anilistMedia.map((m) => m.id);
        const anilistTvdbMap = await batchGetTvdbIds(anilistIds);
        for (const tvdbId of anilistTvdbMap.values()) tvdbIds.add(tvdbId);
      } catch {
        // continue with MAL even if AniList fails
      }

      // MAL source
      if (malClientId) {
        try {
          const malMedia = await getAllMALSeasonalAnime(season, year, malClientId);
          const malIds = malMedia.map((m) => m.id);
          const malTvdbMap = await batchGetTvdbIdsFromMal(malIds);
          for (const tvdbId of malTvdbMap.values()) tvdbIds.add(tvdbId);
        } catch {
          // continue with AniList results even if MAL fails
        }
      }

      return Array.from(tvdbIds).map((id) => ({ TvdbId: id }));
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
