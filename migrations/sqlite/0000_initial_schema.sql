-- Tasks plugin schema — SQLite dialect. v0.1.
-- Idempotent (IF NOT EXISTS) — safe to run against an existing store.

CREATE TABLE IF NOT EXISTS `tasks_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`color` text,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tasks_user_list_prefs` (
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	`show_completed` integer NOT NULL DEFAULT false,
	`default_view_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`, `list_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tasks_views` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`list_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL DEFAULT 'list',
	`config` text NOT NULL DEFAULT '{}',
	`is_default` integer NOT NULL DEFAULT false,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tasks_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`list_id` text NOT NULL,
	`parent_id` text,
	`assignee_id` text,
	`title` text NOT NULL,
	`notes` text,
	`due_date` text,
	`due_time` text,
	`completed_at` integer,
	`sort_order` integer NOT NULL DEFAULT 0,
	`recurrence_rule` text,
	`series_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
