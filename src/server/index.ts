import { Hono } from "hono";
import type { AppBindings, AppEnv } from "./env";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import animeRoutes from "./routes/anime";
import listsRoutes from "./routes/lists";
import { runSync } from "./lib/sync";


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

  try {
    const result = await runSync(c.env.DB, c.env.MAL_CLIENT_ID, true);
    return c.json({ ok: true, result });
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
    ctx.waitUntil(runSync(env.DB, env.MAL_CLIENT_ID));
  },
} satisfies ExportedHandler<AppBindings>;

export { app };
