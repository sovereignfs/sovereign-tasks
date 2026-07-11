import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Plugin schema — sovereign-tasks.
 *
 * Conventions (match platform schema):
 * - IDs: ULIDs stored as text.
 * - Timestamps: Unix epoch seconds stored as integer.
 * - Booleans: integer 0/1 (mode: 'boolean').
 * - tenant_id on every user-scoped table.
 * - All tables prefixed tasks_.
 *
 * v0.1 ships only private, owner-scoped lists and tasks.
 * Nullable future columns (assignee_id, due_date, due_time, recurrence_rule,
 * series_id) are defined now so later milestones add no destructive migrations.
 */

export const tasksLists = sqliteTable('tasks_lists', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  /** Fixed swatch key (see app/_lib/colors.ts LIST_SWATCHES). Mandatory at the
   *  app layer — every list gets a colour on create, default 'black'. Column
   *  stays nullable in SQLite (ALTER COLUMN would need a table rebuild); a
   *  migration backfills any legacy NULLs and listDotColor() falls back
   *  defensively. */
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Per-user, per-list preferences. Not global list state.
 * Composite PK: (tenant_id, user_id, list_id).
 */
export const tasksUserListPrefs = sqliteTable(
  'tasks_user_list_prefs',
  {
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    listId: text('list_id').notNull(),
    /** Default false — completed tasks are hidden until the user toggles this on. */
    showCompleted: integer('show_completed', { mode: 'boolean' }).notNull().default(false),
    /** Nullable. FK → tasks_views; falls back to the list's default view. Added v0.2+. */
    defaultViewId: text('default_view_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.listId] })],
);

/**
 * Saved list presentation modes. v0.1 creates one system "list" view per list.
 * Future view kinds (kanban_minimal, kanban_full, visualizer) add rows here
 * without touching tasks_lists or tasks_items.
 */
export const tasksViews = sqliteTable('tasks_views', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  listId: text('list_id').notNull(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  /** 'list' | 'kanban_minimal' | 'kanban_full' | 'visualizer' */
  kind: text('kind').notNull().default('list'),
  /** View-specific config JSON string. Defaults to '{}'. */
  config: text('config').notNull().default('{}'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tasksItems = sqliteTable('tasks_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  listId: text('list_id').notNull(),
  /** Nullable. FK → tasks_items. Presence = subtask. One level enforced at app layer. */
  parentId: text('parent_id'),
  /** Nullable. Added v0.2. Only meaningful within shared lists. */
  assigneeId: text('assignee_id'),
  title: text('title').notNull(),
  /** Nullable free text. */
  notes: text('notes'),
  /** Starred/favourite flag. Surfaced in the UI as a star toggle. */
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  /** Nullable. ISO date string 'YYYY-MM-DD'. Added v0.3. */
  dueDate: text('due_date'),
  /** Nullable. 'HH:MM' string. Requires due_date. Added v0.3. */
  dueTime: text('due_time'),
  /**
   * Nullable Unix timestamp. Set when the due-time reminder notification for
   * this task was sent (the scheduler's conditional-UPDATE claim marker —
   * see app/_jobs/due-reminders.ts); cleared whenever due_date/due_time
   * change so rescheduling re-arms the reminder. Added v0.11.
   */
  reminderSentAt: integer('reminder_sent_at'),
  /** Nullable Unix timestamp. Set on completion, cleared on reopen. */
  completedAt: integer('completed_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Nullable. RFC 5545 RRULE string. Added v0.4. */
  recurrenceRule: text('recurrence_rule'),
  /** Nullable. ULID shared across all instances of a recurring series. Added v0.4. */
  seriesId: text('series_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Per-user notification preferences (v0.11 — due/overdue notifications).
 * Opt-in: rows exist only after a user opens the notification settings; the
 * scheduler acts only on rows with enabled = true.
 */
export const tasksNotificationPrefs = sqliteTable(
  'tasks_notification_prefs',
  {
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    /** Master switch — nothing is sent while false (the default). */
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    /** Local wall-clock time 'HH:MM' for the daily digest. */
    morningTime: text('morning_time').notNull().default('08:00'),
    /**
     * IANA timezone (e.g. 'Europe/Berlin') captured from the user's browser
     * whenever prefs are saved — defines whose "morning" the digest and the
     * due-time comparisons use.
     */
    timezone: text('timezone').notNull(),
    /**
     * 'YYYY-MM-DD' (user-local) of the last morning digest evaluation — the
     * scheduler's conditional-UPDATE claim marker (see
     * app/_jobs/due-reminders.ts). Nullable = never evaluated.
     */
    lastDigestDate: text('last_digest_date'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

// v0.2 — tasks_list_members will be added here when collaboration lands.
