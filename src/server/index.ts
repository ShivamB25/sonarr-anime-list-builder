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

function getSeasonForMonth(month: number): string {
  if (month >= 1 && month <= 3) return "WINTER";
  if (month >= 4 && month <= 6) return "SPRING";
  if (month >= 7 && month <= 9) return "SUMMER";
  return "FALL";
}

async function warmSeasonFeeds() {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentSeason = getSeasonForMonth(currentMonth);
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];

  const targets = new Set<string>();
  targets.add(`${currentSeason}:${currentYear}`);
  for (const season of seasons) {
    targets.add(`${season}:${currentYear}`);
    targets.add(`${season}:${currentYear - 1}`);
  }

  await Promise.all(
    Array.from(targets).map(async (target) => {
      const [season, year] = target.split(":");
      const url = `https://airing-list-web.edge-5af.workers.dev/api/anime/season-feed?season=${season}&year=${year}`;
      await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
    })
  );
}

export default {
  fetch: app.fetch,
  scheduled: async (
    controller: ScheduledController,
    env: Env["Bindings"],
    ctx: ExecutionContext
  ) => {
    ctx.waitUntil(warmSeasonFeeds());
  },
} satisfies ExportedHandler<Env["Bindings"]>;
