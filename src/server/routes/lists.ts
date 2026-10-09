import { Hono } from "hono";
import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { lists, listItems } from "../db/schema";
import { getOrCreateGuest } from "../lib/auth";
import { batchGetTvdbIds, batchGetTvdbIdsFromMal } from "../lib/anime-mapping";
import type { AppEnv } from "../env";
import { isSeason } from "../../shared/season";


const listsRouter = new Hono<AppEnv>();

interface CreateListBody {
  name: string;
  season?: unknown;
  year?: unknown;
}

interface CreateListItemBody {
  anilistId?: number | null;
  malId?: number | null;
  title: string;
  titleEnglish?: string | null;
  coverImage?: string | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  score?: number | null;
}

async function readJson(c: Context<AppEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function isCreateListBody(value: unknown): value is CreateListBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function isOptionalPositiveSafeInteger(
  value: unknown,
  hasValue: boolean
): boolean {
  return (
    !hasValue ||
    value === null ||
    (typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value > 0)
  );
}

function isCreateListItemBody(value: unknown): value is CreateListItemBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    isOptionalPositiveSafeInteger(
      "anilistId" in value ? value.anilistId : undefined,
      "anilistId" in value && value.anilistId !== undefined
    ) &&
    isOptionalPositiveSafeInteger(
      "malId" in value ? value.malId : undefined,
      "malId" in value && value.malId !== undefined
    ) &&
    (("anilistId" in value && value.anilistId != null) ||
      ("malId" in value && value.malId != null)) &&
    (!("titleEnglish" in value) ||
      value.titleEnglish === null ||
      typeof value.titleEnglish === "string") &&
    (!("coverImage" in value) ||
      value.coverImage === null ||
      typeof value.coverImage === "string") &&
    (!("format" in value) ||
      value.format === null ||
      typeof value.format === "string") &&
    (!("status" in value) ||
      value.status === null ||
      typeof value.status === "string") &&
    (!("episodes" in value) ||
      value.episodes === null ||
      typeof value.episodes === "number") &&
    (!("score" in value) ||
      value.score === null ||
      typeof value.score === "number")
  );
}

listsRouter.get("/", async (c) => {
  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);

  const userLists = await db
    .select()
    .from(lists)
    .where(eq(lists.userId, user.id))
    .orderBy(lists.createdAt);

  return c.json(userLists);
});

listsRouter.post("/", async (c) => {
  const body = await readJson(c);

  if (!isCreateListBody(body)) {
    return c.json({ error: "Name required" }, 400);
  }

  const name = body.name.trim();
  const { season, year } = body;
  if (!name) {
    return c.json({ error: "Name required" }, 400);
  }
  if (season !== undefined && season !== null && !isSeason(season)) {
    return c.json({ error: "Invalid season" }, 400);
  }
  if (
    year !== undefined &&
    year !== null &&
    (typeof year !== "number" || !Number.isInteger(year) || year <= 0)
  ) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);
  const id = crypto.randomUUID();
  const [list] = await db
    .insert(lists)
    .values({ id, userId: user.id, name, season: season ?? null, year: year ?? null })
    .returning();

  return c.json(list, 201);
});

listsRouter.get("/:id", async (c) => {
  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);
  const listId = c.req.param("id");

  const [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)))
    .limit(1);

  if (!list) return c.json({ error: "Not found" }, 404);

  const items = await db
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(listItems.addedAt);

  return c.json({ ...list, items });
});

listsRouter.delete("/:id", async (c) => {
  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);
  const listId = c.req.param("id");

  await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)));

  return c.json({ ok: true });
});

listsRouter.post("/:id/items", async (c) => {
  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);
  const listId = c.req.param("id");

  const [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)))
    .limit(1);

  if (!list) return c.json({ error: "List not found" }, 404);

  const body = await readJson(c);
  if (!isCreateListItemBody(body)) {
    return c.json({ error: "Invalid item" }, 400);
  }

  const id = crypto.randomUUID();
  const [item] = await db
    .insert(listItems)
    .values({
      id,
      listId,
      anilistId: body.anilistId ?? null,
      malId: body.malId ?? null,
      title: body.title,
      titleEnglish: body.titleEnglish ?? null,
      coverImage: body.coverImage ?? null,
      format: body.format ?? null,
      status: body.status ?? null,
      episodes: body.episodes ?? null,
      score: body.score ?? null,
    })
    .returning();

  return c.json(item, 201);
});

listsRouter.delete("/:id/items/:itemId", async (c) => {
  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);
  const listId = c.req.param("id");
  const itemId = c.req.param("itemId");

  const [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, user.id)))
    .limit(1);

  if (!list) return c.json({ error: "List not found" }, 404);

  await db
    .delete(listItems)
    .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)));
  return c.json({ ok: true });
});


// Public Sonarr-compatible feed -- no auth required
// Returns [{ "TvdbId": 12345 }, ...] for Sonarr Custom Import List
listsRouter.get("/:id/sonarr", async (c) => {
  const db = drizzle(c.env.DB);
  const listId = c.req.param("id");

  const [list] = await db
    .select()
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);

  if (!list) return c.json([], 404);

  const items = await db
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId));

  const anilistItems = items.filter(
    (item): item is typeof item & { anilistId: number } =>
      item.anilistId !== null
  );
  const malItems = items.filter(
    (item): item is typeof item & { malId: number } => item.malId !== null
  );
  const tvdbMap = await batchGetTvdbIds(
    anilistItems.map((item) => item.anilistId),
    anilistItems.map((item) => ({
      id: item.anilistId,
      title: item.titleEnglish ?? item.title,
      alternateTitles: [item.title],
    })),
    c.env.TVDB_API_KEY
  );
  const unresolvedMalItems = malItems.filter(
    (item) => item.anilistId === null || !tvdbMap.has(item.anilistId)
  );
  const malTvdbMap = await batchGetTvdbIdsFromMal(
    unresolvedMalItems.map((item) => item.malId),
    unresolvedMalItems.map((item) => ({
      id: item.malId,
      title: item.titleEnglish ?? item.title,
      alternateTitles: [item.title],
    })),
    c.env.TVDB_API_KEY
  );
  const sonarrEntries = [...new Set([...tvdbMap.values(), ...malTvdbMap.values()])]
    .map((TvdbId) => ({ TvdbId }));


  c.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
  c.header("Content-Type", "application/json");
  return c.json(sonarrEntries);
});

export default listsRouter;
