import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  guestToken: text("guest_token").unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const lists = sqliteTable(
  "lists",
  {
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
  },
  (table) => [
    index("lists_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const listItems = sqliteTable(
  "list_items",
  {
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
  },
  (table) => [
    index("list_items_list_added_idx").on(table.listId, table.addedAt),
  ]
);

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
  (table) => [
    primaryKey({
      columns: [table.season, table.year, table.source, table.tvdbId],
    }),
    index("season_feed_entries_season_tvdb_idx").on(
      table.season,
      table.year,
      table.tvdbId
    ),
  ]
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

// Persisted AniList seasonal browse cards for fast homepage/load-more reads
export const seasonalBrowseItems = sqliteTable(
  "seasonal_browse_items",
  {
    season: text("season").notNull(),
    year: integer("year").notNull(),
    page: integer("page").notNull(),
    sortOrder: integer("sort_order").notNull(),
    anilistId: integer("anilist_id").notNull(),
    titleRomaji: text("title_romaji").notNull(),
    titleEnglish: text("title_english"),
    titleNative: text("title_native"),
    coverImageLarge: text("cover_image_large").notNull(),
    coverImageMedium: text("cover_image_medium").notNull(),
    bannerImage: text("banner_image"),
    format: text("format").notNull(),
    status: text("status").notNull(),
    episodes: integer("episodes"),
    averageScore: integer("average_score"),
    genresJson: text("genres_json").notNull(),
    description: text("description"),
    seasonValue: text("season_value").notNull(),
    seasonYear: integer("season_year").notNull(),
    startYear: integer("start_year"),
    startMonth: integer("start_month"),
    startDay: integer("start_day"),
    nextAiringAt: integer("next_airing_at"),
    nextAiringEpisode: integer("next_airing_episode"),
    nextAiringTimeUntil: integer("next_airing_time_until"),
    studiosJson: text("studios_json").notNull(),
    syncRunAt: integer("sync_run_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.season, table.year, table.anilistId] }),
    index("seasonal_browse_items_page_idx").on(
      table.season,
      table.year,
      table.page,
      table.sortOrder
    ),
  ]
);


