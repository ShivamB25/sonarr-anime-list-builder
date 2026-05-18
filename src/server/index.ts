import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import animeRoutes from "./routes/anime";
import listsRoutes from "./routes/lists";
import { runSync } from "./lib/sync";

type Env = {
  Bindings: {
    DB: D1Database;
    SESSION_SECRET: string;
    MAL_CLIENT_ID: string;
    ADMIN_SYNC_TOKEN: string;
  };
};

const app = new Hono<Env>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin,
    credentials: true,
  })
);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default {
  fetch: app.fetch,
  scheduled: async (
    _controller: ScheduledController,
    env: Env["Bindings"],
    ctx: ExecutionContext
  ) => {
    ctx.waitUntil(runSync(env.DB, env.MAL_CLIENT_ID));
  },
} satisfies ExportedHandler<Env["Bindings"]>;

export { app };
