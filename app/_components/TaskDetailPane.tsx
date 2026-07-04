'use client';

import { Checkbox, EmptyState } from '@sovereignfs/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteTask, toggleComplete, updateTask } from '../_lib/actions';
import DueDateControl from './DueDateControl';
import StarButton from './StarButton';
import SubtaskList from './SubtaskList';
import styles from './TaskDetailPane.module.css';

interface DetailTask {
  id: string;
  listId: string;
  parentId: string | null;
  title: string;
  notes: string | null;
  completedAt: number | null;
  favorite: boolean;
  dueDate: string | null;
  dueTime: string | null;
}

export default function TaskDetailPane({
  task,
  listId,
}: {
  task: DetailTask | null;
  listId: string;
}) {
  if (!task) {
    return (
      <div className={styles.emptyWrap}>
        <EmptyState
          icon="eye"
          heading="No task selected"
          description="Click a task to view notes and details."
        />
      </div>
    );
  }
  // Key by id so switching tasks re-initialises the edit buffers.
  return <DetailBody key={task.id} task={task} listId={listId} />;
}

function DetailBody({ task, listId }: { task: DetailTask; listId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const isComplete = task.completedAt !== null;
  const closeHref = `/tasks/${listId}`;

  function commitTitle() {
    const t = title.trim();
    if (t && t !== task.title) {
      startTransition(async () => {
        await updateTask(task.id, task.listId, { title: t });
        router.refresh();
      });
    } else if (!t) {
      setTitle(task.title);
    }
  }

  function commitNotes() {
    const n = notes.trim();
    if (n !== (task.notes ?? '')) {
      startTransition(async () => {
        await updateTask(task.id, task.listId, { notes: n || undefined });
        router.refresh();
      });
    }
  }

  async function handleToggle(checked: boolean) {
    setPending(true);
    await toggleComplete(task.id, task.listId, checked);
    router.refresh();
    setPending(false);
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTask(task.id, task.listId);
      router.replace(closeHref);
      router.refresh();
    });
  }

  return (
    // suppressHydrationWarning: password-manager extensions (e.g. ProtonPass)
    // inject data-* attributes (data-protonpass-form) onto this container before
    // React hydrates, causing a benign server/client attribute mismatch. This
    // suppresses only this element's attribute diff, not its children.
    <div className={styles.body} suppressHydrationWarning>
      <div className={styles.top}>
        <Checkbox
          checked={isComplete}
          onChange={handleToggle}
          label=""
          disabled={pending}
          aria-label={`Mark "${task.title}" ${isComplete ? 'incomplete' : 'complete'}`}
        />
        <input
          className={[styles.title, isComplete ? styles.complete : ''].filter(Boolean).join(' ')}
          value={title}
          aria-label="Task title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setTitle(task.title);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <StarButton taskId={task.id} listId={task.listId} favorite={task.favorite} />
        <Link href={closeHref} replace className={styles.close} aria-label="Close details">
          ✕
        </Link>
      </div>

      <label className={styles.sectionLabel} htmlFor="task-notes">
        Notes
      </label>
      <textarea
        id="task-notes"
        className={styles.notes}
        value={notes}
        placeholder="Add notes…"
        rows={4}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={commitNotes}
      />

      <DueDateControl
        taskId={task.id}
        listId={task.listId}
        dueDate={task.dueDate}
        dueTime={task.dueTime}
        completedAt={task.completedAt}
      />

      {task.parentId === null && (
        <div className={styles.subtasks}>
          <span className={styles.sectionLabel}>Subtasks</span>
          <SubtaskList
            parentId={task.id}
            listId={task.listId}
            showCompleted
            parentCompletedAt={task.completedAt}
            onMutated={() => router.refresh()}
          />
        </div>
      )}

      <button type="button" className={styles.delete} onClick={handleDelete}>
        Delete task
      </button>
    </div>
  );
}
