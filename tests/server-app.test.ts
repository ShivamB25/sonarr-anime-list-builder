import { describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/server/index";
import type { AppBindings } from "../src/server/env";
import {
  createLocalD1Database,
  migrateLocalD1Database,
} from "../src/server/lib/local-d1";
const baseEnv: AppBindings = {
  DB: {} as D1Database,
  MAL_CLIENT_ID: "test-mal-client-id",
  ADMIN_SYNC_TOKEN: "test-admin-token",
};

async function expectJson(
  response: Response,
  status: number,
  body: Record<string, unknown>
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  const actual = (await response.json()) as Record<string, unknown>;
  expect(actual).toEqual(body);
}

describe("Hono application responses", () => {
  test("reports an exact healthy response", async () => {
    const response = await app.request("/api/health", undefined, baseEnv);

    await expectJson(response, 200, { status: "ok" });
  });

  test("rejects malformed registration JSON without touching the database", async () => {
    const response = await app.request(
      "/api/auth/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      },
      baseEnv
    );

    await expectJson(response, 400, {
      error: "Username and password (min 4 chars) required",
    });
  });

  test("rejects a non-canonical list season without touching the database", async () => {
    const response = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Invalid season", season: "AUTUMN", year: 2026 }),
      },
      baseEnv
    );

    await expectJson(response, 400, { error: "Invalid season" });
  });

  test("rejects an unauthorized admin sync without invoking external services", async () => {
    const response = await app.request(
      "/api/admin/run-sync",
      { method: "POST", headers: { authorization: "Bearer wrong-token" } },
      baseEnv
    );

    await expectJson(response, 401, { error: "Unauthorized" });
  });

  test("sanitizes uncaught errors instead of exposing internal details", async () => {
    const internalMessage = "sqlite secret: users table unavailable";
    const errorLog = spyOn(console, "error").mockImplementation(() => {});
    const failingEnv: AppBindings = {
      ...baseEnv,
      DB: {
        prepare() {
          throw new Error(internalMessage);
        },
      } as unknown as D1Database,
    };

    try {
      const response = await app.request("/api/lists", undefined, failingEnv);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(text)).toEqual({ error: "Internal server error" });
      expect(text).not.toContain(internalMessage);
    } finally {
      errorLog.mockRestore();
    }
  });
  test("rejects whitespace-only account and list names", async () => {
    const requests = [
      app.request(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: " \t ", password: "password" }),
        },
        baseEnv
      ),
      app.request(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "\n ", password: "password" }),
        },
        baseEnv
      ),
      app.request(
        "/api/lists",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: " \t\n " }),
        },
        baseEnv
      ),
    ];

    const [registerResponse, loginResponse, listResponse] = await Promise.all(requests);
    await expectJson(registerResponse, 400, {
      error: "Username and password (min 4 chars) required",
    });
    await expectJson(loginResponse, 400, {
      error: "Username and password required",
    });
    await expectJson(listResponse, 400, { error: "Name required" });
  });

  test("normalizes usernames and list names at the server boundary", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "server-app-tests-"));
    const database = createLocalD1Database(join(tempDirectory, "app.sqlite"));
    const env: AppBindings = {
      ...baseEnv,
      DB: database as unknown as D1Database,
    };

    try {
      await migrateLocalD1Database(database, join(import.meta.dir, "../drizzle"));

      const registerResponse = await app.request(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "  normalized-user  ",
            password: "password",
          }),
        },
        env
      );
      expect(registerResponse.status).toBe(200);
      expect(await registerResponse.json()).toMatchObject({
        username: "normalized-user",
      });
      expect(
        database.prepare("SELECT username FROM users").all().results
      ).toEqual([{ username: "normalized-user" }]);

      const loginResponse = await app.request(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: "\tnormalized-user\n",
            password: "password",
          }),
        },
        env
      );
      expect(loginResponse.status).toBe(200);
      expect(await loginResponse.json()).toMatchObject({
        username: "normalized-user",
      });

      const sessionCookie = registerResponse.headers.get("set-cookie")?.split(";")[0];
      if (!sessionCookie) throw new Error("Registration did not set a session cookie");
      const listResponse = await app.request(
        "/api/lists",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: sessionCookie,
          },
          body: JSON.stringify({ name: "  Spring favorites  " }),
        },
        env
      );
      expect(listResponse.status).toBe(201);
      expect(await listResponse.json()).toMatchObject({
        name: "Spring favorites",
      });
      expect(database.prepare("SELECT name FROM lists").all().results).toEqual([
        { name: "Spring favorites" },
      ]);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
