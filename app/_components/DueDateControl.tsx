'use client';

import { Popover } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setDueDate } from '../_lib/actions';
import { formatDueDate, isOverdue, quickDates } from '../_lib/date';
import CalendarGrid from './CalendarGrid';
import CalendarIcon from './CalendarIcon';
import styles from './DueDateControl.module.css';
import type { EditScope } from './useEditScope';

// Matches the "No due date" trigger's rendered width exactly: the detail pane
// is a fixed 340px column (see [listId]/page.module.css), and TaskDetailPane's
// .body has --sv-space-5 (20px) padding on each side — 340 - 40 = 300. Safe to
// hardcode since the pane never resizes (it's hidden below the 900px
// breakpoint, not shrunk).
const POPOVER_WIDTH = 300;

interface Props {
  taskId: string;
  listId: string;
  dueDate: string | null;
  dueTime: string | null;
  completedAt: number | null;
  /** TSK-24 gate — from TaskDetailPane's useEditScope. Resolves straight to
   *  'this' for non-recurring tasks (the common case), no prompt shown. */
  requestScope: (onConfirm: (scope: EditScope) => void) => void;
}

export default function DueDateControl({
  taskId,
  listId,
  dueDate,
  dueTime,
  completedAt,
  requestScope,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const overdue = isOverdue(dueDate, completedAt);

  // Used for calendar-date and time selection — keeps the popover open so
  // picking a date reveals the (now relevant) time field inline, rather than
  // closing and forcing a reopen to set a time.
  function commit(date: string | null, time: string | null) {
    requestScope((scope) => {
      startTransition(async () => {
        await setDueDate(taskId, listId, date, time, scope);
        router.refresh();
      });
    });
  }

  // Used for quick-picks and "Clear due date" — one-shot actions where
  // there's nothing else to do in the popover afterwards.
  function commitAndClose(date: string | null, time: string | null) {
    commit(date, time);
    setOpen(false);
  }

  const trigger = (
    <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
      <span className={styles.icon}>
        <CalendarIcon />
      </span>
      <span
        className={[styles.value, dueDate ? '' : styles.placeholder, overdue ? styles.overdue : '']
          .filter(Boolean)
          .join(' ')}
      >
        {dueDate ? formatDueDate(dueDate, dueTime) : 'No due date'}
      </span>
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      open={open}
      onClose={() => setOpen(false)}
      align="left"
      width={POPOVER_WIDTH}
      aria-label="Set due date"
    >
      <div className={styles.panel}>
        <div className={styles.quick}>
          <button type="button" onClick={() => commitAndClose(quickDates.today(), dueTime)}>
            Today
          </button>
          <button type="button" onClick={() => commitAndClose(quickDates.tomorrow(), dueTime)}>
            Tomorrow
          </button>
          <button type="button" onClick={() => commitAndClose(quickDates.nextWeek(), dueTime)}>
            Next week
          </button>
        </div>

        <CalendarGrid value={dueDate} onSelect={(d) => commit(d, dueTime)} />

        {dueDate && (
          <label className={styles.field}>
            <span>Time</span>
            <input
              type="time"
              value={dueTime ?? ''}
              onChange={(e) => commit(dueDate, e.target.value || null)}
            />
          </label>
        )}

        {dueDate && (
          <button type="button" className={styles.clear} onClick={() => commitAndClose(null, null)}>
            Clear due date
          </button>
        )}
      </div>
    </Popover>
  );
}
