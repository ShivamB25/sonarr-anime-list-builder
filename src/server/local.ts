import { serve } from "bun";
import { app } from "./index";
import {
  createLocalD1Database,
  ensureSqliteDirectory,
  migrateLocalD1Database,
} from "./lib/local-d1";

const port = Number(process.env.PORT ?? "8787");
const dbPath = process.env.SQLITE_PATH ?? "./data/airing-list.sqlite";

await ensureSqliteDirectory(dbPath);
const DB = createLocalD1Database(dbPath);
await migrateLocalD1Database(DB, "./drizzle");

const env = {
  DB,
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  MAL_CLIENT_ID: process.env.MAL_CLIENT_ID ?? "",
  ADMIN_SYNC_TOKEN: process.env.ADMIN_SYNC_TOKEN ?? "",
};

serve({
  port,
  async fetch(request) {
    return app.fetch(request, env);
  },
});

console.log(`Airing List listening on http://0.0.0.0:${port}`);
