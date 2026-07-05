import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

/**
 * Plugin schema — sovereign-tasks (Postgres dialect, migration-generation only).
 *
 * Not imported by application code — `app/_db/schema.ts` (SQLite-core builders)
 * is the single schema application code queries against, regardless of which
 * dialect actually backs `sdk.db.getClient()` in production. Drizzle's runtime
 * query builder is bound to the client instance's own dialect (`node-postgres`
 * vs `better-sqlite3`), not to the table object's origin, so the SQLite-typed
 * table objects work correctly against a Postgres connection as long as the
 * physical columns use types that serialize identically — verified empirically
 * (integer 0/1 round-trips through Drizzle's SQLite `mode: 'boolean'` mapper
 * whether the underlying driver is better-sqlite3 or node-postgres).
 *
 * This file exists solely to drive `pnpm db:generate:pg` for
 * `migrations/postgres/`; keep it a structural mirror of `schema.ts` and
 * NEVER use native Postgres `boolean` or `bigint` types here — that would
 * create physical columns whose types the SQLite-typed query objects don't
 * know how to serialize/deserialize against, breaking writes at runtime.
 */

export const tasksLists = pgTable('tasks_lists', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tasksUserListPrefs = pgTable(
  'tasks_user_list_prefs',
  {
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    listId: text('list_id').notNull(),
    showCompleted: integer('show_completed').notNull().default(0),
    defaultViewId: text('default_view_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId, t.listId] })],
);

export const tasksViews = pgTable('tasks_views', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  listId: text('list_id').notNull(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('list'),
  config: text('config').notNull().default('{}'),
  isDefault: integer('is_default').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tasksItems = pgTable('tasks_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  listId: text('list_id').notNull(),
  parentId: text('parent_id'),
  assigneeId: text('assignee_id'),
  title: text('title').notNull(),
  notes: text('notes'),
  favorite: integer('favorite').notNull().default(0),
  dueDate: text('due_date'),
  dueTime: text('due_time'),
  completedAt: integer('completed_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  recurrenceRule: text('recurrence_rule'),
  seriesId: text('series_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
