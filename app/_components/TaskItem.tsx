'use client';

import { Checkbox, DragHandleRow } from '@sovereignfs/ui';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useState } from 'react';
import { toggleComplete } from '../_lib/actions';
import { formatDueDate, isOverdue } from '../_lib/date';
import type { TaskRow } from '../_lib/types';
import ProgressRing from './ProgressRing';
import StarButton from './StarButton';
import SubtaskList from './SubtaskList';
import styles from './TaskItem.module.css';

interface Props {
  task: TaskRow;
  showCompleted: boolean;
  selected: boolean;
  onMutated: () => void;
}

export default function TaskItem({ task, showCompleted, selected, onMutated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const isComplete = task.completedAt !== null;
  const hasSubtasks = task.subtaskCount > 0;
  const overdue = isOverdue(task.dueDate, task.completedAt);
  const detailHref = `/tasks/${task.listId}?task=${task.id}`;

  async function handleToggle(checked: boolean) {
    setPending(true);
    await toggleComplete(task.id, task.listId, checked);
    onMutated();
    setPending(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[styles.wrapper, selected ? styles.selected : ''].filter(Boolean).join(' ')}
    >
      <DragHandleRow handleProps={{ ...attributes, ...listeners }} isDragging={isDragging}>
        <div className={styles.row}>
          <Checkbox
            checked={isComplete}
            onChange={handleToggle}
            label=""
            disabled={pending}
            aria-label={`Mark "${task.title}" ${isComplete ? 'incomplete' : 'complete'}`}
          />

          <Link href={detailHref} className={styles.main}>
            <span
              className={[styles.title, isComplete ? styles.complete : ''].filter(Boolean).join(' ')}
            >
              {task.title}
            </span>
            {task.notes && <span className={styles.note}>{task.notes}</span>}
            {task.dueDate && (
              <span
                className={[styles.due, overdue ? styles.overdue : ''].filter(Boolean).join(' ')}
              >
                {formatDueDate(task.dueDate, task.dueTime)}
              </span>
            )}
          </Link>

          <div className={styles.right}>
            <StarButton
              taskId={task.id}
              listId={task.listId}
              favorite={task.favorite}
              onMutated={onMutated}
            />
            {hasSubtasks && (
              <button
                type="button"
                className={styles.ringBtn}
                aria-label={expanded ? 'Hide subtasks' : 'Show subtasks'}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                <ProgressRing done={task.subtaskDoneCount} total={task.subtaskCount} />
              </button>
            )}
            <Link href={detailHref} className={styles.chevron} aria-label="Open details">
              ›
            </Link>
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
