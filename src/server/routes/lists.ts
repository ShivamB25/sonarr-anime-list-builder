import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { lists, listItems } from "../db/schema";
import { getOrCreateGuest } from "../lib/auth";
import { batchGetTvdbIds } from "../lib/anime-mapping";

type Env = { Bindings: { DB: D1Database; SESSION_SECRET: string } };

const listsRouter = new Hono<Env>();

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
  const user = await getOrCreateGuest(c);
  const db = drizzle(c.env.DB);
  const { name, season, year } = await c.req.json<{
    name: string;
    season?: string;
    year?: number;
  }>();

  if (!name) return c.json({ error: "Name required" }, 400);

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

  const body = await c.req.json<{
    anilistId: number;
    title: string;
    titleEnglish?: string;
    coverImage?: string;
    format?: string;
    status?: string;
    episodes?: number;
    score?: number;
  }>();

  const id = crypto.randomUUID();
  const [item] = await db
    .insert(listItems)
    .values({
      id,
      listId,
      anilistId: body.anilistId,
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

  await db.delete(listItems).where(eq(listItems.id, itemId));
  return c.json({ ok: true });
});

import { cached } from "../lib/cache";

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

  const anilistIds = items.map((i) => i.anilistId);
  const tvdbMap = await batchGetTvdbIds(anilistIds);

  const sonarrEntries: { TvdbId: number }[] = [];
  for (const id of anilistIds) {
    const tvdbId = tvdbMap.get(id);
    if (tvdbId) sonarrEntries.push({ TvdbId: tvdbId });
  }

  c.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
  c.header("Content-Type", "application/json");
  return c.json(sonarrEntries);
});

export default listsRouter;
