'use client';

import { Icon, Popover, Select } from '@sovereignfs/ui';
import { useState } from 'react';
import { parseLocal, todayISO } from '../_lib/date';
import {
  humanReadable,
  patternToRule,
  ruleToPattern,
  type RecurrenceFreq,
  type RecurrencePattern,
} from '../_lib/recurrence';
import type { EditScope } from './useEditScope';
import styles from './RecurrenceEditor.module.css';

// Date.getDay() is Sunday-first (0=Sun); rrule/recurrence.ts's own weekday
// codes are Monday-first internally, but the stored code strings ('SU'..'SA')
// are the same regardless — this just maps getDay()'s index to that code.
const JS_DAY_TO_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const WEEKDAY_PILLS = [
  { code: 'SU', label: 'S' },
  { code: 'MO', label: 'M' },
  { code: 'TU', label: 'T' },
  { code: 'WE', label: 'W' },
  { code: 'TH', label: 'T' },
  { code: 'FR', label: 'F' },
  { code: 'SA', label: 'S' },
];

interface Props {
  rule: string | null;
  dueDate: string | null;
  /** Caller (TaskDetailPane) owns the actual server call + refresh — this
   *  component only decides *what* the new rule should be. */
  onCommit: (rule: string | null, scope: EditScope) => void;
  requestScope: (onConfirm: (scope: EditScope) => void) => void;
}

export default function RecurrenceEditor({ rule, dueDate, onCommit, requestScope }: Props) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<RecurrencePattern>(() =>
    rule ? ruleToPattern(rule) : { freq: 'WEEKLY', interval: 1 },
  );

  function anchorWeekday(): string {
    const d = dueDate ? parseLocal(dueDate) : new Date();
    return JS_DAY_TO_CODE[d.getDay()] as string;
  }

  function commit(newRule: string | null) {
    requestScope((scope) => onCommit(newRule, scope));
    setOpen(false);
    setCustomOpen(false);
  }

  function applyPreset(kind: RecurrenceFreq | 'WEEKDAYS' | null) {
    if (kind === null) {
      commit(null);
      return;
    }
    if (kind === 'WEEKDAYS') {
      commit(patternToRule({ freq: 'WEEKLY', interval: 1, byweekday: ['MO', 'TU', 'WE', 'TH', 'FR'] }));
      return;
    }
    const pattern: RecurrencePattern = { freq: kind, interval: 1 };
    if (kind === 'WEEKLY') pattern.byweekday = [anchorWeekday()];
    commit(patternToRule(pattern));
  }

  function openCustom() {
    setDraft(rule ? ruleToPattern(rule) : { freq: 'WEEKLY', interval: 1, byweekday: [anchorWeekday()] });
    setCustomOpen(true);
  }

  function toggleWeekday(code: string) {
    setDraft((d) => {
      const has = d.byweekday?.includes(code) ?? false;
      const next = has
        ? (d.byweekday ?? []).filter((c) => c !== code)
        : [...(d.byweekday ?? []), code];
      return { ...d, byweekday: next };
    });
  }

  const trigger = (
    <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
      <span className={styles.icon}>
        <Icon name="rotate-ccw" size="sm" aria-hidden />
      </span>
      <span className={[styles.value, rule ? '' : styles.placeholder].filter(Boolean).join(' ')}>
        {rule ? humanReadable(rule) : 'Does not repeat'}
      </span>
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      open={open}
      onClose={() => {
        setOpen(false);
        setCustomOpen(false);
      }}
      align="left"
      width="trigger"
      aria-label="Set recurrence"
    >
      {!customOpen ? (
        <div className={styles.presets}>
          <button type="button" className={styles.preset} onClick={() => applyPreset(null)}>
            Does not repeat
          </button>
          <button type="button" className={styles.preset} onClick={() => applyPreset('DAILY')}>
            Daily
          </button>
          <button type="button" className={styles.preset} onClick={() => applyPreset('WEEKLY')}>
            Weekly
          </button>
          <button type="button" className={styles.preset} onClick={() => applyPreset('MONTHLY')}>
            Monthly
          </button>
          <button type="button" className={styles.preset} onClick={() => applyPreset('YEARLY')}>
            Yearly
          </button>
          <button type="button" className={styles.preset} onClick={() => applyPreset('WEEKDAYS')}>
            Weekdays (Mon–Fri)
          </button>
          <button type="button" className={styles.preset} onClick={openCustom}>
            Custom…
          </button>
        </div>
      ) : (
        <div className={styles.custom}>
          <div className={styles.everyRow}>
            <span>Repeat every</span>
            <input
              type="number"
              min={1}
              className={styles.intervalInput}
              value={draft.interval}
              onChange={(e) =>
                setDraft((d) => ({ ...d, interval: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
            <Select
              value={draft.freq}
              onChange={(e) => {
                const freq = e.target.value as RecurrenceFreq;
                setDraft((d) => ({
                  ...d,
                  freq,
                  // byweekday only means anything for WEEKLY (and only the
                  // weekday pills below, rendered only in that case, let the
                  // user see/edit it) — clear it on every other frequency so
                  // a stale single-day selection can't silently ride along
                  // into e.g. a Monthly rule. recurrence.ts's toRRule also
                  // ignores byweekday for non-WEEKLY as a second, lower-level
                  // guarantee, but the draft itself should reflect what's
                  // actually being configured.
                  byweekday:
                    freq === 'WEEKLY' ? (d.byweekday?.length ? d.byweekday : [anchorWeekday()]) : undefined,
                }));
              }}
            >
              <option value="DAILY">day(s)</option>
              <option value="WEEKLY">week(s)</option>
              <option value="MONTHLY">month(s)</option>
              <option value="YEARLY">year(s)</option>
            </Select>
          </div>

          {draft.freq === 'WEEKLY' && (
            <div className={styles.weekdays}>
              {WEEKDAY_PILLS.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  className={[
                    styles.weekdayPill,
                    draft.byweekday?.includes(w.code) ? styles.weekdayPillActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={draft.byweekday?.includes(w.code) ?? false}
                  onClick={() => toggleWeekday(w.code)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}

          <div className={styles.ends}>
            <span className={styles.endsLabel}>Ends</span>
            <label className={styles.endOption}>
              <input
                type="radio"
                name="ends"
                checked={!draft.until && draft.count == null}
                onChange={() => setDraft((d) => ({ ...d, until: null, count: null }))}
              />
              Never
            </label>
            <label className={styles.endOption}>
              <input
                type="radio"
                name="ends"
                checked={!!draft.until}
                onChange={() =>
                  setDraft((d) => ({ ...d, until: d.until ?? todayISO(), count: null }))
                }
              />
              On date
              {draft.until != null && (
                <input
                  type="date"
                  className={styles.endDate}
                  value={draft.until}
                  onChange={(e) => setDraft((d) => ({ ...d, until: e.target.value, count: null }))}
                />
              )}
            </label>
            <label className={styles.endOption}>
              <input
                type="radio"
                name="ends"
                checked={draft.count != null}
                onChange={() => setDraft((d) => ({ ...d, count: d.count ?? 5, until: null }))}
              />
              After{' '}
              {draft.count != null && (
                <input
                  type="number"
                  min={1}
                  className={styles.endCount}
                  value={draft.count}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, count: Math.max(1, Number(e.target.value) || 1) }))
                  }
                />
              )}{' '}
              occurrences
            </label>
          </div>

          <div className={styles.customActions}>
            <button type="button" className={styles.back} onClick={() => setCustomOpen(false)}>
              Back
            </button>
            <button type="button" className={styles.done} onClick={() => commit(patternToRule(draft))}>
              Done
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
