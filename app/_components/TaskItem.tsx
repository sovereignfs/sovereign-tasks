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
  subtaskCount: number;
  subtaskDoneCount: number;
}

interface Props {
  task: TaskItemData;
  showCompleted: boolean;
  onMutated: () => void;
}

export default function TaskItem({ task, showCompleted, onMutated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState(task.notes ?? '');
  const [pending, setPending] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingNotes) {
      notesRef.current?.focus();
      const len = notesRef.current?.value.length ?? 0;
      notesRef.current?.setSelectionRange(len, len);
    }
  }, [editingNotes]);

  // Keep local state in sync after server refresh
  useEffect(() => {
    setEditTitle(task.title);
  }, [task.title]);
  useEffect(() => {
    setEditNotes(task.notes ?? '');
  }, [task.notes]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isComplete = task.completedAt !== null;
  const hasSubtasks = task.subtaskCount > 0;

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

  async function handleTitleCommit() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      await updateTask(task.id, task.listId, { title: trimmed });
      onMutated();
    } else {
      setEditTitle(task.title);
    }
    setEditingTitle(false);
  }

  async function handleNotesCommit() {
    const trimmed = editNotes.trim();
    const current = task.notes ?? '';
    if (trimmed !== current) {
      await updateTask(task.id, task.listId, { notes: trimmed || undefined });
      onMutated();
    }
    setEditingNotes(false);
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
            {editingTitle ? (
              <input
                ref={titleInputRef}
                className={styles.editInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleCommit();
                  if (e.key === 'Escape') {
                    setEditTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={[styles.title, isComplete ? styles.complete : ''].filter(Boolean).join(' ')}
                onClick={() => setEditingTitle(true)}
              >
                {task.title}
              </button>
            )}

            {editingNotes ? (
              <textarea
                ref={notesRef}
                className={styles.notesInput}
                value={editNotes}
                rows={2}
                placeholder="Add a note…"
                onChange={(e) => setEditNotes(e.target.value)}
                onBlur={handleNotesCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditNotes(task.notes ?? '');
                    setEditingNotes(false);
                  }
                  // Shift+Enter = newline; plain Enter = save
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleNotesCommit();
                  }
                }}
              />
            ) : task.notes ? (
              <button
                type="button"
                className={styles.notes}
                onClick={() => setEditingNotes(true)}
              >
                {task.notes}
              </button>
            ) : (
              <button
                type="button"
                className={styles.notesPlaceholder}
                onClick={() => setEditingNotes(true)}
              >
                Add a note…
              </button>
            )}

            {hasSubtasks && !expanded && (
              <button
                type="button"
                className={styles.progress}
                aria-label={`${task.subtaskDoneCount} of ${task.subtaskCount} subtasks done — show subtasks`}
                onClick={() => setExpanded(true)}
              >
                {task.subtaskDoneCount}/{task.subtaskCount}
              </button>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={[styles.actionBtn, hasSubtasks ? styles.hasSubtasks : '']
                .filter(Boolean)
                .join(' ')}
              aria-label={expanded ? 'Hide subtasks' : 'Show subtasks'}
              aria-expanded={expanded}
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
          parentCompletedAt={task.completedAt}
          onMutated={onMutated}
        />
      )}
    </div>
  );
}
