import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLocalD1Database,
  migrateLocalD1Database,
  type LocalD1Database,
} from "../src/server/lib/local-d1";

let tempDirectory: string;
let database: LocalD1Database;

beforeEach(async () => {
  tempDirectory = await mkdtemp(join(tmpdir(), "local-d1-tests-"));
  database = createLocalD1Database(join(tempDirectory, "batch.sqlite"));
  await database
    .prepare("CREATE TABLE entries (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE)")
    .run();
});

afterEach(async () => {
  await rm(tempDirectory, { recursive: true, force: true });
});

describe("local D1 batch transactions", () => {
  test("completes every statement and returns one successful result per statement", async () => {
    const results = await database.batch([
      database.prepare("INSERT INTO entries (id, value) VALUES (?, ?)").bind(1, "first"),
      database.prepare("INSERT INTO entries (id, value) VALUES (?, ?)").bind(2, "second"),
    ]);

    expect(results).toEqual([
      { results: [], success: true, meta: {} },
      { results: [], success: true, meta: {} },
    ]);
    expect(database.prepare("SELECT id, value FROM entries ORDER BY id").all().results).toEqual([
      { id: 1, value: "first" },
      { id: 2, value: "second" },
    ]);
  });

  test("rolls back earlier statements when a later statement fails", async () => {
    const batch = database.batch([
      database.prepare("INSERT INTO entries (id, value) VALUES (?, ?)").bind(1, "duplicate"),
      database.prepare("INSERT INTO entries (id, value) VALUES (?, ?)").bind(2, "duplicate"),
    ]);

    await expect(batch).rejects.toThrow();
    expect(database.prepare("SELECT id, value FROM entries").all().results).toEqual([]);
  });
});

describe("local D1 migrations", () => {
  test("rolls back a failed migration and retries it without a marker", async () => {
    const migrationsDirectory = join(tempDirectory, "migrations");
    await mkdir(migrationsDirectory);
    await writeFile(
      join(migrationsDirectory, "0000_retry.sql"),
      [
        "CREATE TABLE migrated_entries (id INTEGER PRIMARY KEY);",
        "--> statement-breakpoint",
        "INSERT INTO missing_table (id) VALUES (1);",
      ].join("\n")
    );

    await expect(
      migrateLocalD1Database(database, migrationsDirectory)
    ).rejects.toThrow();
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .bind("migrated_entries")
        .all().results
    ).toEqual([]);
    expect(
      database
        .prepare("SELECT name FROM __local_migrations WHERE name = ?")
        .bind("0000_retry.sql")
        .all().results
    ).toEqual([]);

    await writeFile(
      join(migrationsDirectory, "0000_retry.sql"),
      [
        "CREATE TABLE migrated_entries (id INTEGER PRIMARY KEY);",
        "--> statement-breakpoint",
        "INSERT INTO migrated_entries (id) VALUES (1);",
      ].join("\n")
    );
    await migrateLocalD1Database(database, migrationsDirectory);

    expect(database.prepare("SELECT id FROM migrated_entries").all().results).toEqual([
      { id: 1 },
    ]);
    expect(
      database.prepare("SELECT name FROM __local_migrations").all().results
    ).toEqual([{ name: "0000_retry.sql" }]);
  });

  test("replays the committed migration history into the final schema", async () => {
    await migrateLocalD1Database(
      database,
      join(import.meta.dir, "../drizzle")
    );

    const applicationTables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('entries', '__local_migrations') ORDER BY name"
      )
      .all().results;
    expect(applicationTables).toEqual([
      { name: "list_items" },
      { name: "lists" },
      { name: "season_feed_entries" },
      { name: "season_feed_sync" },
      { name: "seasonal_browse_items" },
      { name: "users" },
    ]);

    const queryIndexes = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (?, ?, ?, ?) ORDER BY name"
      )
      .bind(
        "list_items_list_added_idx",
        "lists_user_created_idx",
        "season_feed_entries_season_tvdb_idx",
        "seasonal_browse_items_page_idx"
      )
      .all().results;
    expect(queryIndexes).toEqual([
      { name: "list_items_list_added_idx" },
      { name: "lists_user_created_idx" },
      { name: "season_feed_entries_season_tvdb_idx" },
      { name: "seasonal_browse_items_page_idx" },
    ]);

    const appliedMigrations = database
      .prepare("SELECT name FROM __local_migrations ORDER BY name")
      .all().results;
    expect(appliedMigrations).toEqual([
      { name: "0000_lame_banshee.sql" },
      { name: "0001_lovely_meteorite.sql" },
      { name: "0002_zippy_captain_stacy.sql" },
      { name: "0003_mysterious_warbird.sql" },
      { name: "0004_add_query_indexes.sql" },
    ]);
  });
});
