import { describe, expect, spyOn, test } from "bun:test";
import { batchGetTvdbIds } from "../src/server/lib/anime-mapping";

describe("anime TVDB mapping fallbacks", () => {
  test("does not use TVDB during a Fribb outage and retries after recovery", async () => {
    let mappingFetches = 0;
    let tvdbUnavailable = false;
    const mockFetch = Object.assign(
      async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("anime-list-full.json")) {
          mappingFetches++;
          if (mappingFetches === 1) return new Response(null, { status: 503 });
          return Response.json([
            { anilist_id: 1, tvdb_id: 99 },
            { anilist_id: 209983, mal_id: 63817 },
          ]);
        }
        if (url.endsWith("/login")) {
          return Response.json({ data: { token: "test-token" } });
        }
        if (url.includes("/search?")) {
          if (tvdbUnavailable) return new Response(null, { status: 503 });
          // TVDB indexes the franchise's original premiere, not its third season.
          if (new URL(url).searchParams.has("year")) return Response.json({ data: [] });
          return Response.json({
            data: [
              {
                objectID: "series-457532",
                aliases: [
                  "Hell Mode: The Hardcore Gamer Dominates in Another World with Garbage Balancing",
                ],
              },
            ],
          });
        }
        return new Response(null, { status: 404 });
      },
      { preconnect() {} }
    );
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    try {
      await expect(
        batchGetTvdbIds(
          [1],
          [{ id: 1, title: "Unavailable mapping", year: 2026 }],
          "test-api-key"
        )
      ).rejects.toThrow();

      const mappings = await batchGetTvdbIds(
        [1, 209983],
        [
          {
            id: 209983,
            title:
              "HELL MODE: The Hardcore Gamer Dominates in Another World with Garbage Balancing 3rd Season",
            year: 2026,
          },
        ],
        "test-api-key"
      );

      expect(mappings.get(1)).toBe(99);
      expect(mappings.get(209983)).toBe(457532);
      tvdbUnavailable = true;
      await expect(batchGetTvdbIds(
        [209983],
        [{ id: 209983, title: "HELL MODE 3rd Season", year: 2026 }],
        "test-api-key"
      )).rejects.toThrow();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
