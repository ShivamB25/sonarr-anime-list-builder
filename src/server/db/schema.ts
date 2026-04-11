import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  guestToken: text("guest_token").unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const lists = sqliteTable("lists", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  season: text("season"),
  year: integer("year"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const listItems = sqliteTable("list_items", {
  id: text("id").primaryKey(),
  listId: text("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  anilistId: integer("anilist_id").notNull(),
  title: text("title").notNull(),
  titleEnglish: text("title_english"),
  coverImage: text("cover_image"),
  format: text("format"),
  status: text("status"),
  episodes: integer("episodes"),
  score: integer("score"),
  addedAt: integer("added_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Persisted TVDB IDs per season, merged from AniList + MAL
export const seasonFeedEntries = sqliteTable(
  "season_feed_entries",
  {
    season: text("season").notNull(),
    year: integer("year").notNull(),
    tvdbId: integer("tvdb_id").notNull(),
    source: text("source").notNull(), // "anilist" | "mal"
    syncRunAt: integer("sync_run_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.season, t.year, t.source, t.tvdbId] })]
);

// Tracks incremental sync state per (season, year, source)
export const seasonFeedSync = sqliteTable(
  "season_feed_sync",
  {
    season: text("season").notNull(),
    year: integer("year").notNull(),
    source: text("source").notNull(), // "anilist" | "mal"
    nextPage: integer("next_page").notNull().default(1),
    done: integer("done").notNull().default(0), // 0 = pending, 1 = done
    lastSyncedAt: integer("last_synced_at"),
  },
  (t) => [primaryKey({ columns: [t.season, t.year, t.source] })]
);


