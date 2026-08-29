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
    format: "MOVIE",
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
    const mockFetch = Object.assign(
      async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
        const url = String(input);
        if (url.includes("anime-list-full.json")) {
          return Response.json([]);
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
              ? Array.from({ length: 50 }, (_, index) => createMedia(index + 1))
              : body.variables.page === 2
                ? [createMedia(51)]
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

      expect(pages.map((page) => page.media.length)).toEqual([25, 25, 1]);
      expect(pages.flatMap((page) => page.media.map((media) => media.id))).toEqual(
        Array.from({ length: 51 }, (_, index) => index + 1)
      );
    } finally {
      fetchSpy.mockRestore();
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
