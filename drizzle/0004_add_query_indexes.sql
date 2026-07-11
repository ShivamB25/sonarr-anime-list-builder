CREATE INDEX `list_items_list_added_idx` ON `list_items` (`list_id`,`added_at`);--> statement-breakpoint
CREATE INDEX `lists_user_created_idx` ON `lists` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `season_feed_entries_season_tvdb_idx` ON `season_feed_entries` (`season`,`year`,`tvdb_id`);--> statement-breakpoint
CREATE INDEX `seasonal_browse_items_page_idx` ON `seasonal_browse_items` (`season`,`year`,`page`,`sort_order`);