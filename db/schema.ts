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
  /** Nullable. Fixed color swatch key (e.g. 'grey-300'). Full palette decided in v0.2. */
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
  /** Nullable. ISO date string 'YYYY-MM-DD'. Added v0.3. */
  dueDate: text('due_date'),
  /** Nullable. 'HH:MM' string. Requires due_date. Added v0.3. */
  dueTime: text('due_time'),
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

// v0.2 — tasks_list_members will be added here when collaboration lands.
