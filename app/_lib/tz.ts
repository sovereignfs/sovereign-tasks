/**
 * IANA-timezone wall-clock helpers for the notification scheduler
 * (app/_jobs/due-reminders.ts).
 *
 * Deliberately separate from date.ts (which formats the *server-local* dates
 * the UI renders) and from recurrence.ts's UTC helpers (which exist for rrule
 * interop) — these convert an absolute instant into a *specific user's* local
 * calendar date and time-of-day, which is the only correct frame for "every
 * morning" and "at the task's due time".
 *
 * Both outputs are zero-padded strings ('YYYY-MM-DD', 'HH:MM'), matching the
 * storage format of tasks_items.due_date/due_time and
 * tasks_notification_prefs.morning_time — so plain lexicographic comparison
 * (`'09:05' <= '14:30'`, `'2026-07-10' < '2026-07-11'`) is a correct
 * chronological comparison everywhere these values meet.
 */

export interface LocalParts {
  /** 'YYYY-MM-DD' in the given timezone. */
  date: string;
  /** 'HH:MM' (24h, zero-padded) in the given timezone. */
  time: string;
}

/** Whether `tz` names a timezone the runtime's Intl database understands. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The local calendar date and wall-clock time of the instant `epochMs` in
 * `timezone`. Falls back to UTC when the stored timezone is invalid (e.g. an
 * Intl database that no longer knows a renamed zone) — a wrong-but-consistent
 * morning beats a crashed scheduler tick.
 */
export function localNowParts(timezone: string, epochMs: number): LocalParts {
  const zone = isValidTimeZone(timezone) ? timezone : 'UTC';
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // 'h23' (not hour12: false) — the latter can yield '24:00' in some ICU
    // versions at midnight, which would break lexicographic comparison.
    hourCycle: 'h23',
  }).formatToParts(new Date(epochMs));

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}
