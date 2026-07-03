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
  onMutated: () => void;
}

export default function SubtaskList({
  parentId,
  listId,
  showCompleted,
  parentCompletedAt,
  onMutated,
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

  // Reload on mount and whenever the parent's completion changes (cascade).
  useEffect(() => {
    load();
  }, [parentId, listId, parentCompletedAt]);

  const visible = showCompleted ? subtasks : subtasks.filter((s) => s.completedAt === null);

  async function handleToggle(id: string, checked: boolean) {
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
    <div className={styles.root}>
      {visible.map((s) => (
        <div key={s.id} className={styles.row}>
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
