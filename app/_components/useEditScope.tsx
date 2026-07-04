'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './useEditScope.module.css';

export type EditScope = 'this' | 'future' | 'all';

/**
 * TSK-24: editing a recurring task's title, notes, due date, or recurrence
 * rule prompts "this task / this and following / all tasks in the series".
 * Shared across TaskDetailPane's own title/notes commits and the DueDateControl/
 * RecurrenceEditor children (passed `requestScope` as a prop) so there's one
 * dialog instance per task, not one per field.
 *
 * Non-recurring tasks (seriesId === null) skip the prompt entirely and always
 * resolve to 'this' — no behaviour change for the common case.
 */
export function useEditScope(seriesId: string | null) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [onChoose, setOnChoose] = useState<(() => (scope: EditScope) => void) | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (onChoose) el.showModal();
    else el.close();
  }, [onChoose]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => setOnChoose(null);
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, []);

  function requestScope(onConfirm: (scope: EditScope) => void) {
    if (!seriesId) {
      onConfirm('this');
      return;
    }
    // Store the callback itself, not its return value — useState's setter
    // would otherwise try to call it to compute "the next state".
    setOnChoose(() => onConfirm);
  }

  function choose(scope: EditScope) {
    // onChoose is the *wrapper* stored via setOnChoose(() => onConfirm) — call
    // it with no args to unwrap the real callback, then invoke that with scope.
    onChoose?.()(scope);
    setOnChoose(null);
  }

  const dialog = (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop-click-to-dismiss, same pattern as ListSidebar's delete confirm
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Edit recurring task"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOnChoose(null);
      }}
    >
      <div className={styles.body}>
        <h2 className={styles.title}>Edit recurring task</h2>
        <p className={styles.message}>This task repeats. What would you like to change?</p>
        <div className={styles.actions}>
          <button type="button" className={styles.option} onClick={() => choose('this')}>
            This task
          </button>
          <button type="button" className={styles.option} onClick={() => choose('future')}>
            This and following tasks
          </button>
          <button type="button" className={styles.option} onClick={() => choose('all')}>
            All tasks in the series
          </button>
        </div>
        <button type="button" className={styles.cancel} onClick={() => setOnChoose(null)}>
          Cancel
        </button>
      </div>
    </dialog>
  );

  return { requestScope, dialog };
}
