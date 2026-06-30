'use client';

import { Checkbox, DragHandleRow } from '@sovereignfs/ui';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import { deleteTask, toggleComplete, updateTask } from '../_lib/actions';
import SubtaskList from './SubtaskList';
import styles from './TaskItem.module.css';

export interface TaskItemData {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  completedAt: number | null;
  parentId: string | null;
}

interface Props {
  task: TaskItemData;
  showCompleted: boolean;
  onMutated: () => void;
}

export default function TaskItem({ task, showCompleted, onMutated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [pending, setPending] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isComplete = task.completedAt !== null;

  async function handleToggle(checked: boolean) {
    setPending(true);
    await toggleComplete(task.id, task.listId, checked);
    onMutated();
    setPending(false);
  }

  async function handleDelete() {
    await deleteTask(task.id, task.listId);
    onMutated();
  }

  async function handleEditCommit() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      await updateTask(task.id, task.listId, { title: trimmed });
      onMutated();
    }
    setEditing(false);
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.wrapper}>
      <DragHandleRow handleProps={{ ...attributes, ...listeners }} isDragging={isDragging}>
        <div className={styles.row}>
          <Checkbox
            checked={isComplete}
            onChange={handleToggle}
            label=""
            disabled={pending}
            aria-label={`Mark "${task.title}" ${isComplete ? 'incomplete' : 'complete'}`}
          />

          <div className={styles.body}>
            {editing ? (
              <input
                ref={editInputRef}
                className={styles.editInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleEditCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditCommit();
                  if (e.key === 'Escape') {
                    setEditTitle(task.title);
                    setEditing(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={[styles.title, isComplete ? styles.complete : ''].filter(Boolean).join(' ')}
                onClick={() => setEditing(true)}
              >
                {task.title}
              </button>
            )}

            {task.notes && <p className={styles.notes}>{task.notes}</p>}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionBtn}
              aria-label="Show subtasks"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '▴' : '▾'}
            </button>
            <button
              type="button"
              className={[styles.actionBtn, styles.deleteBtn].join(' ')}
              aria-label="Delete task"
              onClick={handleDelete}
            >
              ✕
            </button>
          </div>
        </div>
      </DragHandleRow>

      {expanded && (
        <SubtaskList
          parentId={task.id}
          listId={task.listId}
          showCompleted={showCompleted}
          onMutated={onMutated}
        />
      )}
    </div>
  );
}
