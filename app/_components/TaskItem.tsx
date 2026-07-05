'use client';

import { Checkbox, Icon } from '@sovereignfs/ui';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useState } from 'react';
import { toggleComplete } from '../_lib/actions';
import { formatDueDate, isOverdue } from '../_lib/date';
import { summaryLabel } from '../_lib/recurrence';
import type { TaskRow } from '../_lib/types';
import GripIcon from './GripIcon';
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
      className={[
        styles.wrapper,
        selected ? styles.selected : '',
        isDragging ? styles.dragging : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
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
          {(task.dueDate || task.recurrenceRule) && (
            <span className={styles.dueRow}>
              {task.dueDate && (
                <span className={[styles.due, overdue ? styles.overdue : ''].filter(Boolean).join(' ')}>
                  {formatDueDate(task.dueDate, task.dueTime)}
                </span>
              )}
              {task.recurrenceRule && (
                <span className={styles.repeatIndicator}>
                  <Icon name="rotate-ccw" size="sm" aria-hidden />
                  {summaryLabel(task.recurrenceRule)}
                </span>
              )}
            </span>
          )}
        </Link>

        <div className={styles.right}>
          {hasSubtasks && (
            <button
              type="button"
              className={styles.ringBtn}
              aria-label={expanded ? 'Hide subtasks' : 'Show subtasks'}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <ProgressRing done={task.subtaskDoneCount} total={task.subtaskCount} />
              <Icon
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size="sm"
                aria-hidden
                className={styles.subtaskChevron}
              />
            </button>
          )}
          {/* Always last (rightmost) so its position stays fixed whether or
              not the subtask cluster above is present — .main's flex:1
              already pushes .right flush to the row's edge, so ordering this
              last is enough; no reserved space needed. */}
          <StarButton
            taskId={task.id}
            listId={task.listId}
            favorite={task.favorite}
            onMutated={onMutated}
          />
        </div>
      </div>

      {expanded && (
        <SubtaskList
          parentId={task.id}
          listId={task.listId}
          showCompleted={showCompleted}
          parentCompletedAt={task.completedAt}
          parentSubtaskCount={task.subtaskCount}
          parentSubtaskDoneCount={task.subtaskDoneCount}
          onMutated={onMutated}
        />
      )}
    </div>
  );
}
