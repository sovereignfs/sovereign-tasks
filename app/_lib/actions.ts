'use server';

import { sdk } from '@sovereignfs/sdk';
import { and, asc, desc, eq, isNotNull, isNull, like } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'node:crypto';
import { tasksItems, tasksLists, tasksUserListPrefs, tasksViews } from '../_db/schema';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// We cast to the SQLite type here since the platform default dialect is SQLite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

function now() {
  return Math.floor(Date.now() / 1000);
}

async function getContext() {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;
  return { session, db, userId: session.user.id, tenantId: session.user.tenantId };
}

// ── Lists ──────────────────────────────────────────────────────────────────

export async function getLists() {
  const { db, userId, tenantId } = await getContext();
  const lists = await db
    .select()
    .from(tasksLists)
    .where(and(eq(tasksLists.tenantId, tenantId), eq(tasksLists.ownerId, userId)))
    .orderBy(asc(tasksLists.sortOrder), asc(tasksLists.createdAt));

  // Open-task count per list (top-level, incomplete) in one read. Rows for
  // lists the user doesn't own are simply never looked up in the map below.
  const openRows = await db
    .select({ listId: tasksItems.listId })
    .from(tasksItems)
    .where(
      and(
        eq(tasksItems.tenantId, tenantId),
        isNull(tasksItems.parentId),
        isNull(tasksItems.completedAt),
      ),
    );
  const counts = new Map<string, number>();
  for (const r of openRows) counts.set(r.listId, (counts.get(r.listId) ?? 0) + 1);

  return lists.map((l) => ({ ...l, openCount: counts.get(l.id) ?? 0 }));
}

export async function createList(title: string) {
  const { db, userId, tenantId } = await getContext();
  const existing = await getLists();
  const maxOrder = existing.reduce((m, l) => Math.max(m, l.sortOrder), -1);
  const id = randomUUID();
  const ts = now();

  await db.insert(tasksLists).values({
    id,
    tenantId,
    ownerId: userId,
    title: title.trim(),
    sortOrder: maxOrder + 1,
    createdAt: ts,
    updatedAt: ts,
  });

  // Create default list view
  await db.insert(tasksViews).values({
    id: randomUUID(),
    tenantId,
    listId: id,
    ownerId: userId,
    name: 'List',
    kind: 'list',
    isDefault: true,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
  });

  return id;
}

export async function updateList(listId: string, title: string) {
  const { db, userId, tenantId } = await getContext();
  await db
    .update(tasksLists)
    .set({ title: title.trim(), updatedAt: now() })
    .where(
      and(
        eq(tasksLists.id, listId),
        eq(tasksLists.tenantId, tenantId),
        eq(tasksLists.ownerId, userId),
      ),
    );
}

export async function updateListColor(listId: string, color: string | null) {
  const { db, userId, tenantId } = await getContext();
  await db
    .update(tasksLists)
    .set({ color, updatedAt: now() })
    .where(
      and(
        eq(tasksLists.id, listId),
        eq(tasksLists.tenantId, tenantId),
        eq(tasksLists.ownerId, userId),
      ),
    );
}

export async function deleteList(listId: string) {
  const { db, userId, tenantId } = await getContext();
  // Verify ownership before cascade
  const owned = await db
    .select({ id: tasksLists.id })
    .from(tasksLists)
    .where(
      and(
        eq(tasksLists.id, listId),
        eq(tasksLists.tenantId, tenantId),
        eq(tasksLists.ownerId, userId),
      ),
    );
  if (!owned.length) return;

  // Hard delete — tasks, prefs, views cascade via app layer (no FK on SQLite enforced)
  await db
    .delete(tasksItems)
    .where(and(eq(tasksItems.listId, listId), eq(tasksItems.tenantId, tenantId)));
  await db
    .delete(tasksUserListPrefs)
    .where(and(eq(tasksUserListPrefs.listId, listId), eq(tasksUserListPrefs.tenantId, tenantId)));
  await db
    .delete(tasksViews)
    .where(and(eq(tasksViews.listId, listId), eq(tasksViews.tenantId, tenantId)));
  await db
    .delete(tasksLists)
    .where(and(eq(tasksLists.id, listId), eq(tasksLists.tenantId, tenantId)));
}

// ── Tasks ──────────────────────────────────────────────────────────────────

async function assertListOwnership(db: Db, listId: string, userId: string, tenantId: string) {
  const rows = await db
    .select({ id: tasksLists.id })
    .from(tasksLists)
    .where(
      and(
        eq(tasksLists.id, listId),
        eq(tasksLists.tenantId, tenantId),
        eq(tasksLists.ownerId, userId),
      ),
    );
  if (!rows.length) throw new Error('Not authorized');
}

export async function getTasks(listId: string) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);

  // Top-level tasks, plus a single flat read of every subtask in the list so we
  // can attach per-parent counts without an N+1 fetch. Aggregation happens in
  // JS — a grouped SQL count would be dialect-specific and this list is small.
  const [top, subs] = await Promise.all([
    db
      .select()
      .from(tasksItems)
      .where(
        and(
          eq(tasksItems.listId, listId),
          eq(tasksItems.tenantId, tenantId),
          isNull(tasksItems.parentId),
        ),
      )
      .orderBy(asc(tasksItems.sortOrder), asc(tasksItems.createdAt)),
    db
      .select({ parentId: tasksItems.parentId, completedAt: tasksItems.completedAt })
      .from(tasksItems)
      .where(
        and(
          eq(tasksItems.listId, listId),
          eq(tasksItems.tenantId, tenantId),
          isNotNull(tasksItems.parentId),
        ),
      ),
  ]);

  const counts = new Map<string, { total: number; done: number }>();
  for (const s of subs) {
    if (!s.parentId) continue;
    const c = counts.get(s.parentId) ?? { total: 0, done: 0 };
    c.total += 1;
    if (s.completedAt !== null) c.done += 1;
    counts.set(s.parentId, c);
  }

  return top.map((t) => ({
    ...t,
    subtaskCount: counts.get(t.id)?.total ?? 0,
    subtaskDoneCount: counts.get(t.id)?.done ?? 0,
  }));
}

export async function getTask(taskId: string) {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(tasksItems)
    .where(and(eq(tasksItems.id, taskId), eq(tasksItems.tenantId, tenantId)));
  const task = rows[0];
  if (!task) return null;
  // Authorize via the owning list, not the item row (which has no owner_id).
  await assertListOwnership(db, task.listId, userId, tenantId);
  return task;
}

/** Cross-list search over task titles, scoped to the current user's lists. */
export async function searchTasks(query: string) {
  const { db, userId, tenantId } = await getContext();
  const q = query.trim();
  if (!q) return [];

  const lists = await db
    .select({ id: tasksLists.id, title: tasksLists.title })
    .from(tasksLists)
    .where(and(eq(tasksLists.tenantId, tenantId), eq(tasksLists.ownerId, userId)));
  const listTitles = new Map(lists.map((l) => [l.id, l.title]));
  if (listTitles.size === 0) return [];

  const items = await db
    .select()
    .from(tasksItems)
    .where(and(eq(tasksItems.tenantId, tenantId), like(tasksItems.title, `%${q}%`)))
    .orderBy(desc(tasksItems.updatedAt))
    .limit(50);

  // Keep only items in lists the user owns; attach the list title for grouping.
  return items
    .filter((it) => listTitles.has(it.listId))
    .map((it) => ({ ...it, listTitle: listTitles.get(it.listId) as string }));
}

export async function getSubtasks(parentId: string, listId: string) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  return db
    .select()
    .from(tasksItems)
    .where(and(eq(tasksItems.parentId, parentId), eq(tasksItems.tenantId, tenantId)))
    .orderBy(asc(tasksItems.sortOrder), asc(tasksItems.createdAt));
}

export async function createTask(listId: string, title: string, parentId?: string) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);

  const siblings = await db
    .select({ sortOrder: tasksItems.sortOrder })
    .from(tasksItems)
    .where(
      and(
        eq(tasksItems.listId, listId),
        eq(tasksItems.tenantId, tenantId),
        parentId ? eq(tasksItems.parentId, parentId) : isNull(tasksItems.parentId),
      ),
    );
  const maxOrder = siblings.reduce((m, t) => Math.max(m, t.sortOrder), -1);
  const ts = now();

  const id = randomUUID();
  await db.insert(tasksItems).values({
    id,
    tenantId,
    listId,
    parentId: parentId ?? null,
    title: title.trim(),
    sortOrder: maxOrder + 1,
    createdAt: ts,
    updatedAt: ts,
  });
  return id;
}

export async function updateTask(
  taskId: string,
  listId: string,
  patch: { title?: string; notes?: string },
) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  await db
    .update(tasksItems)
    .set({ ...patch, updatedAt: now() })
    .where(and(eq(tasksItems.id, taskId), eq(tasksItems.tenantId, tenantId)));
}

export async function setDueDate(
  taskId: string,
  listId: string,
  dueDate: string | null,
  dueTime: string | null,
) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  await db
    .update(tasksItems)
    // Due time is only meaningful with a due date; clear it when the date clears.
    .set({ dueDate, dueTime: dueDate ? dueTime : null, updatedAt: now() })
    .where(and(eq(tasksItems.id, taskId), eq(tasksItems.tenantId, tenantId)));
}

export async function toggleFavorite(taskId: string, listId: string, favorite: boolean) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  await db
    .update(tasksItems)
    .set({ favorite, updatedAt: now() })
    .where(and(eq(tasksItems.id, taskId), eq(tasksItems.tenantId, tenantId)));
}

export async function toggleComplete(taskId: string, listId: string, complete: boolean) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  const ts = now();

  // When completing a parent task, also complete all subtasks
  if (complete) {
    await db
      .update(tasksItems)
      .set({ completedAt: ts, updatedAt: ts })
      .where(and(eq(tasksItems.parentId, taskId), eq(tasksItems.tenantId, tenantId)));
  }

  await db
    .update(tasksItems)
    .set({ completedAt: complete ? ts : null, updatedAt: ts })
    .where(and(eq(tasksItems.id, taskId), eq(tasksItems.tenantId, tenantId)));
}

export async function deleteTask(taskId: string, listId: string) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  // Delete subtasks first
  await db
    .delete(tasksItems)
    .where(and(eq(tasksItems.parentId, taskId), eq(tasksItems.tenantId, tenantId)));
  await db
    .delete(tasksItems)
    .where(and(eq(tasksItems.id, taskId), eq(tasksItems.tenantId, tenantId)));
}

export async function reorderTasks(listId: string, orderedIds: string[]) {
  const { db, userId, tenantId } = await getContext();
  await assertListOwnership(db, listId, userId, tenantId);
  const ts = now();
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(tasksItems)
        .set({ sortOrder: index, updatedAt: ts })
        .where(and(eq(tasksItems.id, id), eq(tasksItems.tenantId, tenantId))),
    ),
  );
}

// ── Prefs ──────────────────────────────────────────────────────────────────

export async function getOrCreatePrefs(listId: string) {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(tasksUserListPrefs)
    .where(
      and(
        eq(tasksUserListPrefs.tenantId, tenantId),
        eq(tasksUserListPrefs.userId, userId),
        eq(tasksUserListPrefs.listId, listId),
      ),
    );
  if (rows.length) return rows[0];

  const ts = now();
  await db.insert(tasksUserListPrefs).values({
    tenantId,
    userId,
    listId,
    showCompleted: false,
    createdAt: ts,
    updatedAt: ts,
  });
  return { tenantId, userId, listId, showCompleted: false, defaultViewId: null, createdAt: ts, updatedAt: ts };
}

export async function updatePrefs(listId: string, patch: { showCompleted?: boolean }) {
  const { db, userId, tenantId } = await getContext();
  await db
    .update(tasksUserListPrefs)
    .set({ ...patch, updatedAt: now() })
    .where(
      and(
        eq(tasksUserListPrefs.tenantId, tenantId),
        eq(tasksUserListPrefs.userId, userId),
        eq(tasksUserListPrefs.listId, listId),
      ),
    );
}
