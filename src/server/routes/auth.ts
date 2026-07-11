import { Hono } from "hono";
import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { users } from "../db/schema";
import type { AppEnv } from "../env";
import {
  getOrCreateGuest,
  registerUser,
  loginUser,
  logout,
} from "../lib/auth";


const auth = new Hono<AppEnv>();

interface AuthBody {
  username: string;
  password: string;
}

async function readJson(c: Context<AppEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function isAuthBody(value: unknown): value is AuthBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in value &&
    typeof value.username === "string" &&
    "password" in value &&
    typeof value.password === "string"
  );
}

auth.get("/session", async (c) => {
  const user = await getOrCreateGuest(c);
  return c.json({
    id: user.id,
    username: user.username,
    isGuest: !user.username,
  });
});

auth.post("/register", async (c) => {
  const body = await readJson(c);

  if (!isAuthBody(body)) {
    return c.json({ error: "Username and password (min 4 chars) required" }, 400);
  }

  const username = body.username.trim();
  const { password } = body;

  if (!username || !password || password.length < 4) {
    return c.json({ error: "Username and password (min 4 chars) required" }, 400);
  }

  const db = drizzle(c.env.DB);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    return c.json({ error: "Username already taken" }, 409);
  }

  const passwordHash = await hash(password, 10);
  const user = await registerUser(c, username, passwordHash);
  return c.json({
    id: user.id,
    username: user.username,
    isGuest: false,
  });
});

auth.post("/login", async (c) => {
  const body = await readJson(c);
  if (!isAuthBody(body)) {
    return c.json({ error: "Username and password required" }, 400);
  }

  const username = body.username.trim();
  const { password } = body;
  if (!username || !password) {
    return c.json({ error: "Username and password required" }, 400);
  }

  const db = drizzle(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user || !user.passwordHash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  await loginUser(c, user);
  return c.json({
    id: user.id,
    username: user.username,
    isGuest: false,
  });
});

auth.post("/logout", async (c) => {
  logout(c);
  return c.json({ ok: true });
});

export default auth;
