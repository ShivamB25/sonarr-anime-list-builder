PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_seasonal_browse_items` (
	`season` text NOT NULL,
	`year` integer NOT NULL,
	`page` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`source` text NOT NULL,
	`source_id` integer NOT NULL,
	`anilist_id` integer,
	`mal_id` integer,
	`title_romaji` text NOT NULL,
	`title_english` text,
	`title_native` text,
	`cover_image_large` text NOT NULL,
	`cover_image_medium` text NOT NULL,
	`banner_image` text,
	`format` text NOT NULL,
	`status` text NOT NULL,
	`episodes` integer,
	`average_score` integer,
	`genres_json` text NOT NULL,
	`description` text,
	`season_value` text NOT NULL,
	`season_year` integer NOT NULL,
	`start_year` integer,
	`start_month` integer,
	`start_day` integer,
	`next_airing_at` integer,
	`next_airing_episode` integer,
	`next_airing_time_until` integer,
	`studios_json` text NOT NULL,
	`sync_run_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`season`, `year`, `source`, `source_id`)
);
--> statement-breakpoint
INSERT INTO `__new_seasonal_browse_items`("season", "year", "page", "sort_order", "source", "source_id", "anilist_id", "mal_id", "title_romaji", "title_english", "title_native", "cover_image_large", "cover_image_medium", "banner_image", "format", "status", "episodes", "average_score", "genres_json", "description", "season_value", "season_year", "start_year", "start_month", "start_day", "next_airing_at", "next_airing_episode", "next_airing_time_until", "studios_json", "sync_run_at", "updated_at") SELECT "season", "year", "page", "sort_order", 'anilist', "anilist_id", "anilist_id", NULL, "title_romaji", "title_english", "title_native", "cover_image_large", "cover_image_medium", "banner_image", "format", "status", "episodes", "average_score", "genres_json", "description", "season_value", "season_year", "start_year", "start_month", "start_day", "next_airing_at", "next_airing_episode", "next_airing_time_until", "studios_json", "sync_run_at", "updated_at" FROM `seasonal_browse_items`;--> statement-breakpoint
DROP TABLE `seasonal_browse_items`;--> statement-breakpoint
ALTER TABLE `__new_seasonal_browse_items` RENAME TO `seasonal_browse_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `seasonal_browse_items_page_idx` ON `seasonal_browse_items` (`season`,`year`,`page`,`sort_order`);--> statement-breakpoint
CREATE TABLE `__new_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`anilist_id` integer,
	`mal_id` integer,
	`title` text NOT NULL,
	`title_english` text,
	`cover_image` text,
	`format` text,
	`status` text,
	`episodes` integer,
	`score` integer,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_list_items`("id", "list_id", "anilist_id", "mal_id", "title", "title_english", "cover_image", "format", "status", "episodes", "score", "added_at") SELECT "id", "list_id", "anilist_id", NULL, "title", "title_english", "cover_image", "format", "status", "episodes", "score", "added_at" FROM `list_items`;--> statement-breakpoint
DROP TABLE `list_items`;--> statement-breakpoint
ALTER TABLE `__new_list_items` RENAME TO `list_items`;--> statement-breakpoint
CREATE INDEX `list_items_list_added_idx` ON `list_items` (`list_id`,`added_at`);