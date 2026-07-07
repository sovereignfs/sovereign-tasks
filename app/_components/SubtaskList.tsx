'use client';

import { Checkbox } from '@sovereignfs/ui';
import { useEffect, useRef, useState } from 'react';
import { createTask, deleteTask, getSubtasks, toggleComplete } from '../_lib/actions';
import styles from './SubtaskList.module.css';

interface Subtask {
  id: string;
  title: string;
  completedAt: number | null;
}

interface Props {
  parentId: string;
  listId: string;
  showCompleted: boolean;
  // Parent's completedAt — changes when the parent is completed/reopened, which
  // cascade-updates subtasks server-side. Used purely as a reload trigger so an
  // already-expanded list reflects the cascade without a manual re-expand.
  parentCompletedAt: number | null;
  // Reload triggers only — same idea as parentCompletedAt above. This
  // component keeps its own independent subtasks state (useState/useEffect),
  // so when it's used inline under a task row (TaskItem) alongside a SEPARATE
  // SubtaskList instance in the detail pane, mutating subtasks via one
  // instance doesn't tell the other to refetch (neither parentId, listId, nor
  // parentCompletedAt change just because a subtask was added/toggled
  // elsewhere). Passing the parent row's own subtaskCount/subtaskDoneCount —
  // already re-fetched fresh by getTasks on every router.refresh() — closes
  // that gap. Left undefined by the detail pane, which stays in sync via its
  // own mutations already.
  parentSubtaskCount?: number;
  parentSubtaskDoneCount?: number;
  onMutated: () => void;
  /** Shows a "Subtasks · n/m" label above the rows. Off by default — the
   *  inline usage under a task row (TaskItem) already has the progress ring
   *  + chevron conveying the count, so a second label there would be
   *  redundant. The detail pane (no such indicator nearby) turns it on. */
  showLabel?: boolean;
  /** Renders each subtask as a bordered card rather than a flat row. Off by
   *  default so the compact inline usage under a task row is unaffected —
   *  only the detail pane (matching its notes/due-date/list boxes) opts in. */
  boxedRows?: boolean;
}

export default function SubtaskList({
  parentId,
  listId,
  showCompleted,
  parentCompletedAt,
  parentSubtaskCount,
  parentSubtaskDoneCount,
  onMutated,
  showLabel = false,
  boxedRows = false,
}: Props) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  async function load() {
    const rows = await getSubtasks(parentId, listId);
    setSubtasks(rows as Subtask[]);
  }

  // Reload on mount, whenever the parent's completion changes (cascade), or
  // whenever the parent row's own subtask counts change (a mutation via a
  // sibling SubtaskList instance elsewhere on the page — see the prop docs
  // above).
  useEffect(() => {
    load();
  }, [parentId, listId, parentCompletedAt, parentSubtaskCount, parentSubtaskDoneCount]);

  const visible = showCompleted ? subtasks : subtasks.filter((s) => s.completedAt === null);
  const doneCount = subtasks.filter((s) => s.completedAt !== null).length;

  async function handleToggle(id: string, checked: boolean) {
    // Same complaint as the main task checkbox: waiting on toggleComplete +
    // reload before flipping the box reads as an unresponsive/missed tap on
    // mobile. subtasks is plain local state (not derived from a prop), so a
    // direct optimistic patch is enough — load() below overwrites it with
    // the authoritative row once the round trip actually completes.
    setSubtasks((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, completedAt: checked ? Math.floor(Date.now() / 1000) : null } : s,
      ),
    );
    await toggleComplete(id, listId, checked);
    await load();
    onMutated();
  }

  async function handleDelete(id: string) {
    await deleteTask(id, listId);
    await load();
    onMutated();
  }

  async function handleAdd() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await createTask(listId, trimmed, parentId);
    setNewTitle('');
    setAdding(false);
    await load();
    onMutated();
  }

  return (
    <div className={[styles.root, boxedRows ? styles.rootBoxed : ''].filter(Boolean).join(' ')}>
      {showLabel && (
        <span className={styles.sectionLabel}>
          Subtasks{subtasks.length > 0 ? ` · ${doneCount}/${subtasks.length}` : ''}
        </span>
      )}
      {visible.map((s) => (
        <div key={s.id} className={[styles.row, boxedRows ? styles.rowBoxed : ''].filter(Boolean).join(' ')}>
          <Checkbox
            checked={s.completedAt !== null}
            onChange={(checked) => handleToggle(s.id, checked)}
            label={s.title}
            strikeThrough
          />
          <button
            type="button"
            className={styles.deleteBtn}
            aria-label="Delete subtask"
            onClick={() => handleDelete(s.id)}
          >
            ✕
          </button>
        </div>
      ))}

      {adding ? (
        <div className={styles.addRow}>
          <input
            ref={addInputRef}
            className={styles.addInput}
            placeholder="Subtask title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') {
                setNewTitle('');
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!newTitle.trim()) setAdding(false);
            }}
          />
        </div>
      ) : (
        <button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>
          + Add subtask
        </button>
      )}
    </div>
  );
}
