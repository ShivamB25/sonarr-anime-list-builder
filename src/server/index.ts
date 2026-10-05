import { Hono } from "hono";
import type { AppBindings, AppEnv } from "./env";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import animeRoutes from "./routes/anime";
import listsRoutes from "./routes/lists";
import { runSync, type SyncOptions } from "./lib/sync";
import { SEASONS, type Season } from "../shared/season";


const app = new Hono<AppEnv>();

app.use("*", logger());

app.route("/api/auth", authRoutes);
app.route("/api/anime", animeRoutes);
app.route("/api/lists", listsRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.post("/api/admin/run-sync", async (c) => {
  const authHeader = c.req.header("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token || token !== c.env.ADMIN_SYNC_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const seasonParam = c.req.query("season");
  const yearParam = c.req.query("year");
  const forceParam = c.req.query("force")?.toLowerCase();
  const hasSeason = seasonParam !== undefined;
  const hasYear = yearParam !== undefined;
  if (hasSeason !== hasYear) {
    return c.json({ error: "Season and year must be provided together" }, 400);
  }
  if (
    forceParam !== undefined &&
    !["true", "false", "1", "0"].includes(forceParam)
  ) {
    return c.json({ error: "Force must be true, false, 1, or 0" }, 400);
  }
  const force = forceParam === "true" || forceParam === "1";
  const normalizedSeason = seasonParam?.toUpperCase();
  const year = yearParam === undefined ? undefined : Number(yearParam);
  if (
    normalizedSeason !== undefined &&
    !SEASONS.includes(normalizedSeason as Season)
  ) {
    return c.json({ error: "Invalid season" }, 400);
  }
  if (yearParam !== undefined && (!Number.isInteger(year) || year! < 1)) {
    return c.json({ error: "Year must be a positive integer" }, 400);
  }
  if (force && !hasSeason) {
    return c.json({ error: "Force requires a targeted season and year" }, 400);
  }
  const options: SyncOptions | undefined = normalizedSeason && year !== undefined
    ? { season: normalizedSeason as Season, year, force }
    : undefined;

  try {
    const result = await runSync(
      c.env.DB,
      c.env.MAL_CLIENT_ID,
      c.env.TVDB_API_KEY,
      options
    );
    return c.json({ ok: result.completed, result }, result.completed ? 200 : 502);
  } catch {
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  fetch: app.fetch,
  scheduled: async (
    _controller: ScheduledController,
    env: AppBindings,
    ctx: ExecutionContext
  ) => {
    ctx.waitUntil(runSync(env.DB, env.MAL_CLIENT_ID, env.TVDB_API_KEY).then((result) => {
      if (!result.completed) {
        throw new Error(result.errors.map((error) =>
          `[${error.source}] ${error.season} ${error.year}: ${error.message}`
        ).join("\n"));
      }
    }));
  },
} satisfies ExportedHandler<AppBindings>;

export { app };
