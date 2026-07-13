/**
 * Reserved pseudo-id for the "Starred" virtual list (TSK-28) — aggregates
 * every starred task across the user's real lists. It owns no row in
 * `tasks_lists`, no tasks, and is never persisted; tasks shown in it always
 * remain in (and display) their source list. Real list ids are UUIDs, so
 * this string can never collide with one.
 */
export const STARRED_LIST_ID = 'starred';

export function isVirtualListId(id: string): boolean {
  return id === STARRED_LIST_ID;
}
