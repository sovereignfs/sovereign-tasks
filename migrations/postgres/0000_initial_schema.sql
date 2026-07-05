CREATE TABLE "tasks_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"list_id" text NOT NULL,
	"parent_id" text,
	"assignee_id" text,
	"title" text NOT NULL,
	"notes" text,
	"favorite" integer DEFAULT 0 NOT NULL,
	"due_date" text,
	"due_time" text,
	"completed_at" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"recurrence_rule" text,
	"series_id" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_user_list_prefs" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"list_id" text NOT NULL,
	"show_completed" integer DEFAULT 0 NOT NULL,
	"default_view_id" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "tasks_user_list_prefs_tenant_id_user_id_list_id_pk" PRIMARY KEY("tenant_id","user_id","list_id")
);
--> statement-breakpoint
CREATE TABLE "tasks_views" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"list_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'list' NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
