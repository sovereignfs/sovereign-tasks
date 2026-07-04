/**
 * Recurrence helpers — all occurrence math goes through `rrule` (sv-RFC 5545);
 * no custom recurrence logic is written, per CLAUDE.md.
 *
 * v1 covers the common patterns (daily/weekly/monthly/yearly, every-N,
 * specific weekdays), matching Google Tasks' own repeat picker. "Nth weekday
 * of month" (e.g. "last Friday") is deferred — TSK-22 lists it, but it's the
 * most complex picker UI and covers few real cases.
 *
 * Stored `recurrence_rule` strings never embed DTSTART — a task's own
 * `due_date` is always the effective anchor, supplied at computation time.
 * This keeps the stored rule independent of any one instance's date.
 *
 * IMPORTANT — rrule operates on UTC internally. Constructing its `dtstart` (or
 * any date passed to `.after()`) via a *local* `new Date(y, m, d)` silently
 * shifts which weekday matches byweekday rules by one day on servers with a
 * positive UTC offset (verified empirically: a Tuesday dtstart built with
 * `new Date(2026, 6, 7)` produced a Tue/Thu/Sat sequence for a Mon/Wed/Fri
 * rule instead of Mon/Wed/Fri). Every date that crosses the rrule boundary in
 * this file goes through parseUTC/toISODateUTC below, not app/_lib/date.ts's
 * local parseLocal/toISODate (which are correct for this plugin's UI display
 * elsewhere, just not for rrule interop).
 */
import { RRule, type Weekday } from 'rrule';

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurrencePattern {
  freq: RecurrenceFreq;
  /** Every N [freq units]. */
  interval: number;
  /** Only meaningful for WEEKLY. 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'. */
  byweekday?: string[];
  /** Inclusive end date (ISO), or null/undefined for no end. */
  until?: string | null;
  /** End after N occurrences, or null/undefined for no limit. */
  count?: number | null;
}

const FREQ_MAP: Record<RecurrenceFreq, number> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
};

const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
const WEEKDAY_MAP: Record<string, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

/** Parses a stored 'YYYY-MM-DD' as UTC midnight — see the module doc above. */
function parseUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** Reads a rrule-computed Date back into 'YYYY-MM-DD' via UTC getters — must
 *  match parseUTC's construction, or the date can roll to the wrong day
 *  depending on the reader's local timezone offset. */
function toISODateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toRRule(pattern: RecurrencePattern, dtstart: Date | null = null): RRule {
  return new RRule({
    freq: FREQ_MAP[pattern.freq],
    interval: pattern.interval,
    byweekday: pattern.byweekday?.map((d) => WEEKDAY_MAP[d]).filter((d) => d !== undefined),
    until: pattern.until ? parseUTC(pattern.until) : null,
    count: pattern.count ?? null,
    dtstart,
  });
}

/** Serialize a structured pattern to a stored RRULE string (no DTSTART). */
export function patternToRule(pattern: RecurrencePattern): string {
  return toRRule(pattern).toString();
}

/** Parse a stored RRULE string back into the structured picker shape. */
export function ruleToPattern(rule: string): RecurrencePattern {
  const opts = RRule.parseString(rule);
  const freqEntry = (Object.entries(FREQ_MAP) as [RecurrenceFreq, number][]).find(
    ([, v]) => v === opts.freq,
  );
  const byweekday = Array.isArray(opts.byweekday)
    ? opts.byweekday
        .map((d) => (typeof d === 'object' && d !== null ? d.weekday : d))
        .filter((n): n is number => typeof n === 'number')
        .map((n) => WEEKDAY_CODES[n])
        .filter((c): c is (typeof WEEKDAY_CODES)[number] => c !== undefined)
    : undefined;

  return {
    freq: freqEntry?.[0] ?? 'WEEKLY',
    interval: opts.interval ?? 1,
    byweekday,
    until: opts.until ? toISODateUTC(opts.until) : null,
    count: opts.count ?? null,
  };
}

/** Human-readable summary, e.g. "every week on Monday, Wednesday, Friday".
 *  Describes the rule's own configured fields (freq/interval/byweekday) — not
 *  date-anchored iteration, so the UTC-vs-local distinction above doesn't
 *  apply here (verified: a local, "wrong-weekday" dtstart still produced
 *  correctly-worded text describing the actual byweekday list). */
export function humanReadable(rule: string): string {
  const opts = RRule.parseString(rule);
  return new RRule({ ...opts, dtstart: opts.dtstart ?? new Date() }).toText();
}

const WEEKDAYS_SET = ['MO', 'TU', 'WE', 'TH', 'FR'];
const FREQ_LABEL: Record<RecurrenceFreq, { simple: string; unit: string }> = {
  DAILY: { simple: 'Daily', unit: 'day' },
  WEEKLY: { simple: 'Weekly', unit: 'week' },
  MONTHLY: { simple: 'Monthly', unit: 'month' },
  YEARLY: { simple: 'Yearly', unit: 'year' },
};

/** Compact summary for tight spaces (the task row) — e.g. "Weekly", "Every 2
 *  weeks", "Weekdays". Omits the weekday list and any end condition, unlike
 *  humanReadable() above, which is meant for the roomier detail pane. */
export function summaryLabel(rule: string): string {
  const pattern = ruleToPattern(rule);
  const isWeekdaysOnly =
    pattern.freq === 'WEEKLY' &&
    pattern.interval === 1 &&
    pattern.byweekday?.length === WEEKDAYS_SET.length &&
    WEEKDAYS_SET.every((d) => pattern.byweekday?.includes(d));
  if (isWeekdaysOnly) return 'Weekdays';

  const { simple, unit } = FREQ_LABEL[pattern.freq];
  return pattern.interval === 1 ? simple : `Every ${pattern.interval} ${unit}s`;
}

/** Next occurrence strictly after `afterDate` (the task's current due date),
 *  or null once the series has ended (UNTIL/COUNT exhausted). */
export function nextOccurrence(rule: string, afterDate: string): string | null {
  const anchor = parseUTC(afterDate);
  const opts = RRule.parseString(rule);
  const next = new RRule({ ...opts, dtstart: anchor }).after(anchor, false);
  return next ? toISODateUTC(next) : null;
}
