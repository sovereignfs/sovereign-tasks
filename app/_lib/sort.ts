import { isDueTodayOrOverdue } from './date';
import type { TaskRow } from './types';

/**
 * Client-side-only task ordering, chosen via TasksPane's header menu. Not
 * persisted (matches the existing `filter` control's pattern) — it resets to
 * `'manual'` on reload or navigating to a different list. `'manual'` is the
 * server-driven drag order already baked into the array TasksPane receives;
 * every other option re-sorts a copy without touching that order.
 */
export type SortBy = 'manual' | 'date' | 'dueDate' | 'title';

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'manual', label: 'Custom' },
  { value: 'date', label: 'Date created' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'title', label: 'Title (A-Z)' },
];

export function sortTasks(tasks: TaskRow[], sortBy: SortBy): TaskRow[] {
  if (sortBy === 'manual') return tasks;

  const sorted = [...tasks];
  switch (sortBy) {
    case 'date':
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'dueDate':
      // Nulls (no due date) sort last regardless of direction.
      sorted.sort((a, b) => {
        if (a.dueDate === null && b.dueDate === null) return 0;
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return sorted;
}

/**
 * Stable partition: overdue-or-due-today tasks float to the top, everything
 * else follows — each group keeping whatever relative order it already had
 * (manual drag order, or the result of sortTasks above). Applied after
 * sortTasks, unconditionally of sortBy/filter, so it's "always on" per its
 * own design rather than a separate mode to pick.
 *
 * Drag-reorder note: TasksPane's dragDisabled stays tied to sortBy==='manual'
 * only, not to this partition. A drag that stays within one group (two
 * pinned tasks, or two unpinned ones) reorders correctly. A drag that
 * crosses the pinned/unpinned boundary still writes a valid manual order,
 * but since pin membership is date-driven (not a manual property), the
 * dragged task's on-screen position can snap back to its own group on the
 * next render — the same intentional "sort wins over a crossing drag"
 * behavior TasksPane already accepts for the date/dueDate/title sorts.
 */
export function pinDueTodayAndOverdue(tasks: TaskRow[]): TaskRow[] {
  const due: TaskRow[] = [];
  const rest: TaskRow[] = [];
  for (const t of tasks) {
    (isDueTodayOrOverdue(t.dueDate, t.completedAt) ? due : rest).push(t);
  }
  return due.length === 0 ? tasks : [...due, ...rest];
}
