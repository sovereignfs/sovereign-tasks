-- Tasks plugin — add favorite (starred) flag to tasks_items.
-- SQLite ALTER ADD COLUMN; runs once, tracked via the migration journal.

ALTER TABLE `tasks_items` ADD `favorite` integer DEFAULT false NOT NULL;
