'use client';

import { Popover } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { moveTask } from '../_lib/actions';
import { listDotColor } from '../_lib/colors';
import styles from './ListPickerControl.module.css';

interface ListOption {
  id: string;
  title: string;
  color: string | null;
}

interface Props {
  taskId: string;
  currentListId: string;
  lists: ListOption[];
}

export default function ListPickerControl({ taskId, currentListId, lists }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const current = lists.find((l) => l.id === currentListId);

  function handleSelect(toListId: string) {
    setOpen(false);
    if (toListId === currentListId) return;
    startTransition(async () => {
      await moveTask(taskId, currentListId, toListId);
      // The task now lives under a different list route — follow it there,
      // keeping the detail pane open on the same task.
      router.push(`/tasks/${toListId}?task=${taskId}`);
      router.refresh();
    });
  }

  const trigger = (
    <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
      <span
        className={styles.dot}
        style={{ background: listDotColor(current?.color) }}
        aria-hidden
      />
      <span className={styles.value}>{current?.title ?? 'Unknown list'}</span>
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      open={open}
      onClose={() => setOpen(false)}
      align="left"
      width="trigger"
      aria-label="Move to list"
    >
      <div className={styles.menu}>
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            className={[styles.menuItem, l.id === currentListId ? styles.menuItemActive : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleSelect(l.id)}
          >
            <span className={styles.dot} style={{ background: listDotColor(l.color) }} aria-hidden />
            <span className={styles.menuItemLabel}>{l.title}</span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
