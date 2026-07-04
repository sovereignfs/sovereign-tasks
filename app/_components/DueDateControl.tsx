'use client';

import { Popover } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setDueDate } from '../_lib/actions';
import { formatDueDate, isOverdue, quickDates } from '../_lib/date';
import styles from './DueDateControl.module.css';

interface Props {
  taskId: string;
  listId: string;
  dueDate: string | null;
  dueTime: string | null;
  completedAt: number | null;
}

export default function DueDateControl({ taskId, listId, dueDate, dueTime, completedAt }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const overdue = isOverdue(dueDate, completedAt);

  function commit(date: string | null, time: string | null) {
    startTransition(async () => {
      await setDueDate(taskId, listId, date, time);
      router.refresh();
    });
    setOpen(false);
  }

  const trigger = (
    <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
      <span className={styles.label}>Due date</span>
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
      aria-label="Set due date"
    >
      <div className={styles.panel}>
        <div className={styles.quick}>
          <button type="button" onClick={() => commit(quickDates.today(), dueTime)}>
            Today
          </button>
          <button type="button" onClick={() => commit(quickDates.tomorrow(), dueTime)}>
            Tomorrow
          </button>
          <button type="button" onClick={() => commit(quickDates.nextWeek(), dueTime)}>
            Next week
          </button>
        </div>
        <label className={styles.field}>
          <span>Date</span>
          <input
            type="date"
            value={dueDate ?? ''}
            onChange={(e) => commit(e.target.value || null, dueTime)}
          />
        </label>
        <label className={styles.field}>
          <span>Time</span>
          <input
            type="time"
            value={dueTime ?? ''}
            disabled={!dueDate}
            onChange={(e) => commit(dueDate, e.target.value || null)}
          />
        </label>
        {dueDate && (
          <button type="button" className={styles.clear} onClick={() => commit(null, null)}>
            Clear due date
          </button>
        )}
      </div>
    </Popover>
  );
}
