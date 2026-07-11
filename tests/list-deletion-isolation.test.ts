import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/server/index";
import type { AppBindings } from "../src/server/env";
import {
  createLocalD1Database,
  migrateLocalD1Database,
  type LocalD1Database,
} from "../src/server/lib/local-d1";

interface CreatedList {
  id: string;
}

interface CreatedItem {
  id: string;
  listId: string;
  title: string;
}

interface ListDetailBody {
  id: string;
  items: CreatedItem[];
}

let tempDirectory: string;
let env: AppBindings;

beforeEach(async () => {
  tempDirectory = await mkdtemp(join(tmpdir(), "airing-list-tests-"));
  const database: LocalD1Database = createLocalD1Database(join(tempDirectory, "test.sqlite"));
  await migrateLocalD1Database(database, join(import.meta.dir, "../drizzle"));
  env = {
    DB: database as unknown as D1Database,
    MAL_CLIENT_ID: "test-mal-client-id",
    ADMIN_SYNC_TOKEN: "test-admin-token",
  };
});

afterEach(async () => {
  await rm(tempDirectory, { recursive: true, force: true });
});

async function createList(name: string, cookie?: string) {
  const response = await app.request(
    "/api/lists",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ name }),
    },
    env
  );
  expect(response.status).toBe(201);
  return {
    list: (await response.json()) as CreatedList,
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie,
  };
}

async function addItem(listId: string, title: string, anilistId: number, cookie: string) {
  const response = await app.request(
    `/api/lists/${listId}/items`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title, anilistId }),
    },
    env
  );
  expect(response.status).toBe(201);
  return (await response.json()) as CreatedItem;
}

describe("list item deletion isolation", () => {
  test("does not delete an item when its ID is submitted under a different list", async () => {
    const first = await createList("First list");
    expect(first.cookie).toBeDefined();
    const cookie = first.cookie as string;
    const second = await createList("Second list", cookie);
    const secondItem = await addItem(second.list.id, "Protected item", 2026, cookie);

    const deletion = await app.request(
      `/api/lists/${first.list.id}/items/${secondItem.id}`,
      { method: "DELETE", headers: { cookie } },
      env
    );
    expect(deletion.status).toBe(200);
    const deletionBody = (await deletion.json()) as { ok: boolean };
    expect(deletionBody).toEqual({ ok: true });

    const detailResponse = await app.request(
      `/api/lists/${second.list.id}`,
      { headers: { cookie } },
      env
    );
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as ListDetailBody;
    expect(detail.id).toBe(second.list.id);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]).toMatchObject({
      id: secondItem.id,
      listId: second.list.id,
      title: "Protected item",
    });
  });
});
