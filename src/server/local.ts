import { serve } from "bun";
import { join, normalize } from "node:path";
import { app } from "./index";
import type { AppBindings } from "./env";
import {
  createLocalD1Database,
  ensureSqliteDirectory,
  migrateLocalD1Database,
} from "./lib/local-d1";

const port = Number(process.env.PORT ?? "8787");
const dbPath = process.env.SQLITE_PATH ?? "./data/airing-list.sqlite";
const assetsDir = process.env.ASSETS_DIR ?? "./dist/client";

await ensureSqliteDirectory(dbPath);
const localDb = createLocalD1Database(dbPath);
await migrateLocalD1Database(localDb, "./drizzle");

const env = {
  DB: localDb as unknown as D1Database,
  MAL_CLIENT_ID: process.env.MAL_CLIENT_ID ?? "",
  ADMIN_SYNC_TOKEN: process.env.ADMIN_SYNC_TOKEN ?? "",
  TVDB_API_KEY: process.env.TVDB_API_KEY,
} satisfies AppBindings;

serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const response = await app.fetch(request, env);

    if (url.pathname.startsWith("/api") || response.status !== 404) {
      return response;
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(assetsDir, pathname));
    const asset = Bun.file(filePath);

    if (await asset.exists()) {
      return new Response(asset);
    }

    return new Response(Bun.file(join(assetsDir, "index.html")));
  },
});

console.log(`Airing List listening on http://0.0.0.0:${port}`);
