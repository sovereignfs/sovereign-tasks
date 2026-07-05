'use client';

import { Button, Popover } from '@sovereignfs/ui';
import { useEffect, useRef, useState } from 'react';
import { listDotColor } from '../_lib/colors';
import type { ListRow } from '../_lib/types';
import styles from './BulkActionBar.module.css';

interface Props {
  count: number;
  lists: ListRow[];
  currentListId: string;
  onDelete: () => void;
  onMove: (toListId: string) => void;
  onCancel: () => void;
}

/**
 * TSK-20/21 — floating bar shown while one or more tasks are bulk-selected
 * (ctrl/cmd-click or long-press on a row, see TaskItem). Delete confirms via
 * the same content-sized native <dialog> pattern as ListSidebar's delete
 * confirm; move-to-list reuses ListPickerControl's Popover menu shape.
 */
export default function BulkActionBar({
  count,
  lists,
  currentListId,
  onDelete,
  onMove,
  onCancel,
}: Props) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = deleteDialogRef.current;
    if (!el) return;
    if (confirmingDelete) el.showModal();
    else el.close();
  }, [confirmingDelete]);

  useEffect(() => {
    const el = deleteDialogRef.current;
    if (!el) return;
    const handleClose = () => setConfirmingDelete(false);
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, []);

  return (
    <div className={styles.bar} role="toolbar" aria-label="Bulk task actions">
      <span className={styles.count}>{count} selected</span>
      <div className={styles.actions}>
        <Popover
          trigger={
            <Button variant="secondary" size="sm" onClick={() => setMoveOpen((v) => !v)}>
              Move to list
            </Button>
          }
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          align="right"
          aria-label="Move selected tasks to list"
        >
          <div className={styles.menu}>
            {lists
              .filter((l) => l.id !== currentListId)
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setMoveOpen(false);
                    onMove(l.id);
                  }}
                >
                  <span
                    className={styles.dot}
                    style={{ background: listDotColor(l.color) }}
                    aria-hidden
                  />
                  <span className={styles.menuItemLabel}>{l.title}</span>
                </button>
              ))}
            {lists.length <= 1 && (
              <span className={styles.menuEmpty}>No other lists to move to.</span>
            )}
          </div>
        </Popover>
        <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)}>
          Delete
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop-click-to-dismiss, same pattern as ListSidebar's delete confirm */}
      <dialog
        ref={deleteDialogRef}
        className={styles.confirmNativeDialog}
        aria-label="Delete tasks"
        onClick={(e) => {
          if (e.target === e.currentTarget) setConfirmingDelete(false);
        }}
      >
        <div className={styles.confirm}>
          <h2 className={styles.confirmTitle}>
            Delete {count} {count === 1 ? 'task' : 'tasks'}
          </h2>
          <p className={styles.confirmText}>
            This permanently removes the selected tasks and their subtasks. This can’t be undone.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmingDelete(false);
                onDelete();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
