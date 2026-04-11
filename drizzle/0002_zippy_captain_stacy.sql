PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_season_feed_entries` (
	`season` text NOT NULL,
	`year` integer NOT NULL,
	`tvdb_id` integer NOT NULL,
	`source` text NOT NULL,
	`sync_run_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`season`, `year`, `source`, `tvdb_id`)
);
--> statement-breakpoint
INSERT INTO `__new_season_feed_entries`("season", "year", "tvdb_id", "source", "sync_run_at", "updated_at") SELECT "season", "year", "tvdb_id", "source", "updated_at", "updated_at" FROM `season_feed_entries`;--> statement-breakpoint
DROP TABLE `season_feed_entries`;--> statement-breakpoint
ALTER TABLE `__new_season_feed_entries` RENAME TO `season_feed_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;