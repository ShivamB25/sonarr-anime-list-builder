import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import animeRoutes from "./routes/anime";
import listsRoutes from "./routes/lists";

type Env = { Bindings: { DB: D1Database; SESSION_SECRET: string } };

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

export default app;
