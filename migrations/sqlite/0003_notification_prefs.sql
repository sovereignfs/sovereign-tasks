-- Tasks plugin — due/overdue notifications (v0.11).
-- New per-user notification prefs table (opt-in; rows appear only once a user
-- opens the notification settings) and a reminder-sent claim marker on
-- tasks_items for the scheduler's idempotent due-time reminders.

CREATE TABLE `tasks_notification_prefs` (
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`morning_time` text DEFAULT '08:00' NOT NULL,
	`timezone` text NOT NULL,
	`last_digest_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `tasks_items` ADD `reminder_sent_at` integer;
