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

describe("Hono application responses", () => {
  test("rejects malformed registration JSON", async () => {
    const response = await app.request(
      "/api/auth/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      },
      baseEnv
    );

    expect(response.status).toBe(400);
  });

  test("rejects a non-canonical list season", async () => {
    const response = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Invalid season", season: "AUTUMN", year: 2026 }),
      },
      baseEnv
    );

    expect(response.status).toBe(400);
  });

  test("rejects an unauthorized admin sync request", async () => {
    const response = await app.request(
      "/api/admin/run-sync",
      { method: "POST", headers: { authorization: "Bearer wrong-token" } },
      baseEnv
    );

    expect(response.status).toBe(401);
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
    expect(registerResponse.status).toBe(400);
    expect(loginResponse.status).toBe(400);
    expect(listResponse.status).toBe(400);
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
      expect(
        (await database.prepare("SELECT name FROM lists").all()).results
      ).toEqual([{ name: "Spring favorites" }]);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
