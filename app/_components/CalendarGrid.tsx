'use client';

import { useEffect, useState } from 'react';
import { getCalendarMonthDays, monthLabel, parseLocal, todayISO } from '../_lib/date';
import styles from './CalendarGrid.module.css';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  /** Selected ISO date, or null. */
  value: string | null;
  onSelect: (date: string) => void;
}

export default function CalendarGrid({ value, onSelect }: Props) {
  const initial = value ? parseLocal(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // Jump to the selected date's month whenever it changes externally (e.g. a
  // quick-pick button, or reopening the popover on an already-dated task) —
  // the view shouldn't stay stuck wherever it first happened to mount.
  useEffect(() => {
    if (!value) return;
    const d = parseLocal(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const days = getCalendarMonthDays(viewYear, viewMonth);
  const today = todayISO();

  return (
    <div className={styles.root}>
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} aria-label="Previous month" onClick={prevMonth}>
          ‹
        </button>
        <span className={styles.navLabel}>{monthLabel(viewYear, viewMonth)}</span>
        <button type="button" className={styles.navBtn} aria-label="Next month" onClick={nextMonth}>
          ›
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={i} className={styles.weekday}>
            {w}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className={[
              styles.day,
              !d.inMonth ? styles.dayOutside : '',
              d.date === today ? styles.dayToday : '',
              d.date === value ? styles.daySelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(d.date)}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  );
}
