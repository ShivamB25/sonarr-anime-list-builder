import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { users } from "../db/schema";
import {
  getOrCreateGuest,
  getSessionUser,
  registerUser,
  loginUser,
  logout,
} from "../lib/auth";

type Env = { Bindings: { DB: D1Database; SESSION_SECRET: string } };

const auth = new Hono<Env>();

auth.get("/session", async (c) => {
  const user = await getOrCreateGuest(c);
  return c.json({
    id: user.id,
    username: user.username,
    isGuest: !user.username,
  });
});

auth.post("/register", async (c) => {
  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

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
  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

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
