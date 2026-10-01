import { afterEach, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/server/index";
import type { AppBindings } from "../src/server/env";
import { runSync } from "../src/server/lib/sync";
import {
  createLocalD1Database,
  migrateLocalD1Database,
} from "../src/server/lib/local-d1";

const season = "SUMMER";
const year = 2099;

function createMedia(id: number) {
  return {
    id,
    title: { romaji: `Anime ${id}`, english: null, native: null },
    coverImage: { large: `https://example.com/${id}.jpg`, medium: `https://example.com/${id}-small.jpg` },
    bannerImage: null,
    format: "TV",
    status: "NOT_YET_RELEASED",
    episodes: 1,
    averageScore: null,
    genres: [],
    season,
    seasonYear: year,
    description: null,
    nextAiringEpisode: null,
    startDate: { year, month: 7, day: 1 },
    studios: { nodes: [] },
  };
}

afterEach(() => {
  setSystemTime();
});

describe("seasonal browse synchronization", () => {
  test("preserves global ordering across upstream AniList pages", async () => {
    setSystemTime(new Date("2099-08-29T00:00:00Z"));
    const tempDirectory = await mkdtemp(join(tmpdir(), "seasonal-sync-tests-"));
    const database = createLocalD1Database(join(tempDirectory, "app.sqlite"));
    let refresh = false;
    const mockFetch = Object.assign(
      async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
        const url = String(input);
        if (url.includes("anime-list-full.json")) {
          return Response.json(Array.from({ length: 52 }, (_, index) => ({
            anilist_id: index + 1,
            tvdb_id: index + 800001,
          })));
        }

        if (url === "https://graphql.anilist.co") {
          const body = JSON.parse(String(init?.body)) as {
            variables: { season: string; seasonYear: number; page: number };
          };
          const isTarget =
            body.variables.season === season && body.variables.seasonYear === year;
          const media = !isTarget
            ? []
            : body.variables.page === 1
              ? Array.from({ length: 50 }, (_, index) => createMedia(index + (refresh ? 2 : 1)))
              : body.variables.page === 2
                ? [createMedia(refresh ? 52 : 51)]
                : [];

          return Response.json({
            data: {
              Page: {
                pageInfo: {
                  hasNextPage: isTarget && body.variables.page === 1,
                  currentPage: body.variables.page,
                  lastPage: isTarget ? 2 : 1,
                  total: isTarget ? 51 : 0,
                },
                media,
              },
            },
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      },
      { preconnect() {} }
    );
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    try {
      await migrateLocalD1Database(database, join(import.meta.dir, "../drizzle"));
      await runSync(database as unknown as AppBindings["DB"], "", undefined, true);
      await runSync(database as unknown as AppBindings["DB"], "", undefined, true);

      const env: AppBindings = {
        DB: database as unknown as AppBindings["DB"],
        MAL_CLIENT_ID: "",
        ADMIN_SYNC_TOKEN: "test-token",
      };
      const responses = await Promise.all(
        [1, 2, 3].map((page) =>
          app.request(`/api/anime/seasonal?season=${season}&year=${year}&page=${page}`, undefined, env)
        )
      );
      const pages = await Promise.all(
        responses.map((response) => response.json() as Promise<{ media: { id: number }[] }>)
      );

      expect(pages.flatMap((page) => page.media.map((media) => media.id))).toEqual(
        Array.from({ length: 51 }, (_, index) => index + 1)
      );

      refresh = true;
      setSystemTime(new Date("2099-08-30T00:00:01Z"));
      await runSync(env.DB, "", undefined, true);
      // Neither catalog nor feed drops old members before the final page succeeds.
      expect((await database.prepare("SELECT anilist_id FROM seasonal_browse_items WHERE anilist_id = 1").all()).results)
        .toEqual([{ anilist_id: 1 }]);
      expect((await database.prepare("SELECT tvdb_id FROM season_feed_entries WHERE tvdb_id = 800001").all()).results)
        .toEqual([{ tvdb_id: 800001 }]);
      await runSync(env.DB, "", undefined, true);
      const refreshed = (await database.prepare(
        "SELECT anilist_id FROM seasonal_browse_items ORDER BY sort_order"
      ).all()).results;
      expect(refreshed.map((row) => row.anilist_id)).toEqual(
        Array.from({ length: 51 }, (_, index) => index + 2)
      );
      const refreshedFeed = (await database.prepare(
        "SELECT tvdb_id FROM season_feed_entries ORDER BY tvdb_id"
      ).all()).results;
      expect(refreshedFeed).toEqual(
        Array.from({ length: 51 }, (_, index) => ({ tvdb_id: index + 800002 }))
      );
    } finally {
      fetchSpy.mockRestore();
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});

describe("seasonal Sonarr membership", () => {
  test(
    "keeps finished, continuing, and undated series in the historical feed",
    async () => {
      const targetSeason = "WINTER";
      const targetYear = 2100;
      setSystemTime(new Date(`${targetYear}-11-01T00:00:00Z`));
      const directory = await mkdtemp(join(tmpdir(), "season-feed-tests-"));
      const database = createLocalD1Database(join(directory, "app.sqlite"));
      const media = [
        { ...createMedia(1), format: "TV", status: "FINISHED" },
        { ...createMedia(2), format: "TV", status: "RELEASING", startDate: { year: 1999, month: 1, day: 1 } },
        { ...createMedia(3), format: "TV_SHORT", startDate: { year: null, month: null, day: null } },
        { ...createMedia(4), format: "TV", status: "CANCELLED" },
        { ...createMedia(5), format: "MOVIE" },
        { ...createMedia(6), format: "ONA", status: "FINISHED" },
      ];
      let mappingUnavailable = false;
      const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
        async (input: string | URL | Request, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("anime-list-full.json")) {
            if (mappingUnavailable) return new Response(null, { status: 503 });
            return Response.json(Array.from({ length: 9 }, (_, index) => ({
              anilist_id: index + 1,
              mal_id: index + 101,
              tvdb_id: index + 700001,
            })));
          }
          if (url === "https://graphql.anilist.co") {
            const { variables } = JSON.parse(String(init?.body)) as {
              variables: { season: string; seasonYear: number };
            };
            return Response.json({ data: { Page: {
              pageInfo: { hasNextPage: false },
              media: variables.season === targetSeason && variables.seasonYear === targetYear ? media : [],
            } } });
          }
          if (url.startsWith("https://api.myanimelist.net/")) {
            const target = url.includes(`/season/${targetYear}/${targetSeason.toLowerCase()}?`);
            const secondPage = new URL(url).searchParams.get("offset") === "500";
            const nodes = !target ? [] : secondPage ? [
              { id: 108, title: "Undated premiere", media_type: "tv", status: "not_yet_aired" },
              { id: 109, title: "Movie", media_type: "movie", status: "finished_airing" },
              { id: 110, title: "Unmapped series", media_type: "tv", status: "finished_airing" },
            ] : [
              { id: 101, title: "Same series from MAL", media_type: "tv", status: "finished_airing", start_date: `${targetYear}-01-01` },
              { id: 107, title: "Long-running series", media_type: "tv", status: "currently_airing", start_date: "1999-01-01" },
            ];
            return Response.json({
              data: nodes.map((node) => ({ node })),
              paging: target && !secondPage ? { next: "next page" } : {},
            });
          }
          throw new Error(`Unexpected fetch: ${url}`);
        }, { preconnect() {} }
      ));
      try {
        await migrateLocalD1Database(database, join(import.meta.dir, "../drizzle"));
        const env: AppBindings = {
          DB: database as unknown as AppBindings["DB"],
          MAL_CLIENT_ID: "test-client",
          ADMIN_SYNC_TOKEN: "",
        };
        await runSync(env.DB, env.MAL_CLIENT_ID, undefined, true);
        const response = await app.request(
          `/api/anime/season-feed?season=${targetSeason}&year=${targetYear}`, undefined, env
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(
          [700001, 700002, 700003, 700006, 700007, 700008].map((TvdbId) => ({ TvdbId }))
        );

        mappingUnavailable = true;
        setSystemTime(new Date(`${targetYear}-11-02T00:00:01Z`));
        await expect(runSync(env.DB, env.MAL_CLIENT_ID, undefined, true)).rejects.toThrow();
        const retained = (await database.prepare(
          "SELECT DISTINCT tvdb_id FROM season_feed_entries WHERE season = ? AND year = ? ORDER BY tvdb_id"
        ).bind(targetSeason, targetYear).all()).results;
        expect(retained).toEqual(
          [700001, 700002, 700003, 700006, 700007, 700008].map((tvdb_id) => ({ tvdb_id }))
        );
      } finally {
        fetchSpy.mockRestore();
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
