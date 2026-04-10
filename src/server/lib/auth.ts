import { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";

type Env = { DB: D1Database; SESSION_SECRET: string };

function generateId() {
  return crypto.randomUUID();
}

export async function getOrCreateGuest(c: Context<{ Bindings: Env }>) {
  const db = drizzle(c.env.DB);
  let token = getCookie(c, "session_token");

  if (token) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.guestToken, token))
      .limit(1);
    if (existing) return existing;
  }

  token = generateId();
  const id = generateId();
  const [user] = await db
    .insert(users)
    .values({ id, guestToken: token })
    .returning();

  setCookie(c, "session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return user;
}

export async function getSessionUser(c: Context<{ Bindings: Env }>) {
  const db = drizzle(c.env.DB);
  const token = getCookie(c, "session_token");
  if (!token) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.guestToken, token))
    .limit(1);
  return user ?? null;
}

export async function registerUser(
  c: Context<{ Bindings: Env }>,
  username: string,
  passwordHash: string
) {
  const db = drizzle(c.env.DB);
  const currentUser = await getSessionUser(c);

  if (currentUser) {
    const [updated] = await db
      .update(users)
      .set({ username, passwordHash })
      .where(eq(users.id, currentUser.id))
      .returning();
    return updated;
  }

  const id = generateId();
  const token = generateId();
  const [user] = await db
    .insert(users)
    .values({ id, username, passwordHash, guestToken: token })
    .returning();

  setCookie(c, "session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return user;
}

export async function loginUser(
  c: Context<{ Bindings: Env }>,
  user: { id: string; guestToken: string | null }
) {
  const token = user.guestToken ?? generateId();

  if (!user.guestToken) {
    const db = drizzle(c.env.DB);
    await db
      .update(users)
      .set({ guestToken: token })
      .where(eq(users.id, user.id));
  }

  setCookie(c, "session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export function logout(c: Context) {
  deleteCookie(c, "session_token", { path: "/" });
}
