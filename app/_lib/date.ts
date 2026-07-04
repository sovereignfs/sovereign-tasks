/**
 * Due-date helpers. Dates are stored as local 'YYYY-MM-DD' strings; times as
 * 'HH:MM'. All comparisons use the viewer's local day, so overdue styling is
 * computed in client components (not server-rendered) to avoid timezone/midnight
 * hydration mismatches.
 */

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** ISO date `days` from today (local). */
export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export const quickDates = {
  today: () => todayISO(),
  tomorrow: () => addDaysISO(1),
  nextWeek: () => addDaysISO(7),
};

export function isOverdue(dueDate: string | null, completedAt: number | null): boolean {
  if (!dueDate || completedAt !== null) return false;
  return dueDate < todayISO();
}

/** Parse a stored 'YYYY-MM-DD' into a local Date (avoids UTC-parse day drift). */
function parseLocal(dueDate: string): Date {
  const [y, m, d] = dueDate.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Short, relative-when-close label, e.g. "Today", "Tomorrow", "Mar 5". */
export function formatDueDate(dueDate: string | null, dueTime?: string | null): string {
  if (!dueDate) return '';
  let label: string;
  if (dueDate === todayISO()) label = 'Today';
  else if (dueDate === addDaysISO(1)) label = 'Tomorrow';
  else if (dueDate === addDaysISO(-1)) label = 'Yesterday';
  else {
    const d = parseLocal(dueDate);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    label = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  }
  return dueTime ? `${label} · ${dueTime}` : label;
}
