import { afterEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker, { app } from "../src/server/index";
import type { AppBindings } from "../src/server/env";
import type { SyncResult } from "../src/server/lib/sync";
import { createLocalD1Database, migrateLocalD1Database } from "../src/server/lib/local-d1";

afterEach(() => setSystemTime());

test("keeps healthy MAL updates when AniList fails and reports the failure to operators", async () => {
  setSystemTime(new Date("2102-10-01T00:00:00Z"));
  const directory = await mkdtemp(join(tmpdir(), "sync-failure-tests-"));
  const database = createLocalD1Database(join(directory, "app.sqlite"));
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "graphql.anilist.co") {
        return Response.json({ errors: [{ message: "Upstream access blocked", status: 403 }], data: null }, { status: 403 });
      }
      if (url.pathname.endsWith("anime-list-full.json")) {
        return Response.json([
          { mal_id: 801, tvdb_id: 700801 },
          { mal_id: 802, tvdb_id: 700802 },
          { mal_id: 803, tvdb_id: 700803 },
        ]);
      }
      if (url.hostname === "api.myanimelist.net") {
        const target = url.pathname === "/v2/anime/season/2102/fall";
        const media = target ? [
          { id: 801, title: "Continuing series", media_type: "tv", nsfw: "white" },
          { id: 802, title: "Gray-rated series", media_type: "ona", nsfw: "gray" },
          { id: 803, title: "Explicit adult series", media_type: "tv", nsfw: "black" },
        ] : [];
        const visible = url.searchParams.get("nsfw") === "true"
          ? media : media.filter((item) => item.nsfw === "white");
        return Response.json({ data: visible.map((node) => ({ node })), paging: {} });
      }
      throw new Error(`Unexpected request: ${url}`);
    }, { preconnect() {} }
  ));

  try {
    await migrateLocalD1Database(database, join(import.meta.dir, "../drizzle"));
    await database.prepare(
      "INSERT INTO season_feed_entries (season, year, tvdb_id, source, sync_run_at, updated_at) VALUES ('FALL', 2102, 700800, 'anilist', 1, 1)"
    ).run();
    const env: AppBindings = {
      DB: database as unknown as AppBindings["DB"],
      MAL_CLIENT_ID: "test-client",
      ADMIN_SYNC_TOKEN: "test-sync-token",
    };
    const response = await app.request("/api/admin/run-sync", {
      method: "POST",
      headers: { authorization: `Bearer ${env.ADMIN_SYNC_TOKEN}` },
    }, env);
    expect(response.status).toBe(502);
    const body = await response.json() as { ok: boolean; result: SyncResult };
    expect(body.ok).toBe(false);
    expect(body.result.errors.some((error) =>
      error.source === "anilist" && error.season === "FALL" && error.year === 2102
    )).toBe(true);

    const feed = await app.request("/api/anime/season-feed?season=FALL&year=2102", undefined, env);
    expect(await feed.json()).toEqual([
      { TvdbId: 700800 }, { TvdbId: 700801 }, { TvdbId: 700802 },
    ]);

    const pending: Promise<unknown>[] = [];
    await worker.scheduled({} as Parameters<typeof worker.scheduled>[0], env, {
      waitUntil(promise: Promise<unknown>) { pending.push(promise); },
    } as Parameters<typeof worker.scheduled>[2]);
    await expect(Promise.all(pending)).rejects.toThrow();
  } finally {
    fetchSpy.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
