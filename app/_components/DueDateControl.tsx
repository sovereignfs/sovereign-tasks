'use client';

import { Button, Popover } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setDueDate } from '../_lib/actions';
import { formatDueDate, isOverdue, quickDates } from '../_lib/date';
import CalendarGrid from './CalendarGrid';
import CalendarIcon from './CalendarIcon';
import styles from './DueDateControl.module.css';
import type { EditScope } from './useEditScope';

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

  // Used for the time field — keeps the popover open, since reopening it to
  // set a time (see commitAndClose below) already lands directly on a
  // visible Time field; there's nothing gained by closing on every keystroke.
  function commit(date: string | null, time: string | null) {
    requestScope((scope) => {
      startTransition(async () => {
        await setDueDate(taskId, listId, date, time, scope);
        router.refresh();
      });
    });
  }

  // Used for quick-picks, calendar-date selection, and "Clear due date" —
  // one-shot actions that close the popover immediately. If the user also
  // wants a time, they reopen (the Time field is already visible once a date
  // is set) and close explicitly via "Done" once finished.
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
      // Matches the trigger's own rendered width exactly — a fixed pixel
      // value assumed the desktop-only 340px detail column and was too
      // narrow on the mobile detail drawer, where this control spans the
      // drawer's full width instead.
      width="trigger"
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

        <CalendarGrid value={dueDate} onSelect={(d) => commitAndClose(d, dueTime)} />

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
          <div className={styles.actions}>
            {/* Plain text link, not a bordered Button — Done is the actual
                primary action here; giving Clear its own matching button
                chrome made the two compete for attention instead of reading
                as "main action + a quieter, secondary one". */}
            <button type="button" className={styles.clear} onClick={() => commitAndClose(null, null)}>
              Clear due date
            </button>
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Popover>
  );
}
