import { describe, expect, spyOn, test } from "bun:test";
import { batchGetTvdbIds } from "../src/server/lib/anime-mapping";

describe("anime TVDB mapping fallbacks", () => {
  test("uses Fribb first and resolves a missing mapping through TVDB", async () => {
    const mockFetch = Object.assign(
      async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("anime-list-full.json")) {
          return Response.json([
            { anilist_id: 1, tvdb_id: 99 },
            { anilist_id: 209983, mal_id: 63817 },
          ]);
        }
        if (url.endsWith("/login")) {
          return Response.json({ data: { token: "test-token" } });
        }
        if (url.includes("/search?")) {
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
      const mappings = await batchGetTvdbIds(
        [1, 209983],
        [
          {
            id: 209983,
            title:
              "HELL MODE: The Hardcore Gamer Dominates in Another World with Garbage Balancing Season 2",
            year: 2026,
          },
        ],
        "test-api-key"
      );

      expect(mappings.get(1)).toBe(99);
      expect(mappings.get(209983)).toBe(457532);
      expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/login"))).toBe(
        true
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
