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
  { value: 'manual', label: 'Manual' },
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
