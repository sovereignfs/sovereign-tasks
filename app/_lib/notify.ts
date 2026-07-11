/**
 * Pure notification-content helpers for the scheduler
 * (app/_jobs/due-reminders.ts). Kept IO-free so the phrasing and the
 * digest-due decision are unit-testable without a database.
 */

/**
 * One-line morning-digest headline, or null when there is nothing to say
 * (no notification is sent for an empty morning).
 */
export function digestSummary(dueToday: number, overdue: number): string | null {
  const parts: string[] = [];
  if (dueToday > 0) parts.push(`${String(dueToday)} ${dueToday === 1 ? 'task' : 'tasks'} due today`);
  if (overdue > 0) {
    parts.push(dueToday > 0 ? `${String(overdue)} overdue` : `${String(overdue)} ${overdue === 1 ? 'task' : 'tasks'} overdue`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Whether the morning digest should be evaluated now: the user's local clock
 * has reached their chosen morning time and no digest ran for this local day
 * yet. All inputs are zero-padded local strings (see tz.ts), so lexicographic
 * comparison is chronological.
 */
export function isDigestDue(
  localTime: string,
  morningTime: string,
  lastDigestDate: string | null,
  localDate: string,
): boolean {
  return localTime >= morningTime && (lastDigestDate === null || lastDigestDate < localDate);
}
