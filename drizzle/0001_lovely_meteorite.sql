CREATE TABLE `season_feed_entries` (
	`season` text NOT NULL,
	`year` integer NOT NULL,
	`tvdb_id` integer NOT NULL,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`season`, `year`, `tvdb_id`)
);
--> statement-breakpoint
CREATE TABLE `season_feed_sync` (
	`season` text NOT NULL,
	`year` integer NOT NULL,
	`source` text NOT NULL,
	`next_page` integer DEFAULT 1 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`last_synced_at` integer,
	PRIMARY KEY(`season`, `year`, `source`)
);
