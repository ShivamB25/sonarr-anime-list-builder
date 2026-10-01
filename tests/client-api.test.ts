import { afterEach, describe, expect, test } from "bun:test";
import { api, ApiError } from "../src/client/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function installFetch(response: Response) {
  globalThis.fetch = Object.assign(async () => response, { preconnect() {} });
}

describe("seasonal API loading", () => {
  test("loads every season page without a manual continuation", async () => {
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input), "https://example.test");
      const page = Number(url.searchParams.get("page"));
      return Response.json({
        pageInfo: {
          hasNextPage: page < 3,
          currentPage: page,
          lastPage: 3,
          total: 3,
        },
        media: [{ id: page }],
      });
    }) as typeof fetch;

    const media = await api.anime.seasonal("SUMMER", 2026);

    expect(media.map((anime) => anime.id)).toEqual([1, 2, 3]);
  });
});

describe("ApiError response handling", () => {
  test("preserves the server error message and ApiError type", async () => {
    installFetch(Response.json({ error: "List not found" }, { status: 404 }));

    const error = await api.lists.get("missing").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "List not found" });
  });

  test("falls back to the HTTP status when the JSON error body is null", async () => {
    installFetch(Response.json(null, { status: 502 }));

    const operation = api.lists.getAll();

    await expect(operation).rejects.toEqual(
      expect.objectContaining({ status: 502 })
    );
  });

  test("falls back to the HTTP status when the error body is not JSON", async () => {
    installFetch(new Response("upstream unavailable", { status: 503 }));

    const operation = api.lists.getAll();

    await expect(operation).rejects.toEqual(
      expect.objectContaining({ status: 503 })
    );
  });

});
