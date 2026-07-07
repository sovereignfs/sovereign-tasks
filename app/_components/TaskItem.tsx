'use client';

import { Checkbox, Icon } from '@sovereignfs/ui';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { toggleComplete } from '../_lib/actions';
import { formatDueDate, isOverdue } from '../_lib/date';
import { summaryLabel } from '../_lib/recurrence';
import type { TaskRow } from '../_lib/types';
import GripIcon from './GripIcon';
import ProgressRing from './ProgressRing';
import StarButton from './StarButton';
import SubtaskList from './SubtaskList';
import styles from './TaskItem.module.css';

// TSK-20/21: how long a touch must be held before it counts as a long-press
// (the touch equivalent of a desktop ctrl/cmd-click) to enter bulk-select.
const LONG_PRESS_MS = 500;

interface Props {
  task: TaskRow;
  showCompleted: boolean;
  selected: boolean;
  /** TSK-19 — keyboard row focus (j/k), distinct from `selected` (detail pane open). */
  keyFocused?: boolean;
  /** TSK-20/21 — this row is part of the active bulk selection. */
  bulkSelected?: boolean;
  /** Ctrl/cmd-click or long-press toggles this row's membership in the bulk selection. */
  onBulkToggle?: (taskId: string) => void;
  onMutated: () => void;
  /**
   * True whenever TasksPane's sortBy isn't 'manual'. Dragging a row while the
   * list is displayed in a derived order (date/due date/title) would compute
   * the wrong reorder — dnd-kit sees the *visible* (sorted) index positions,
   * not the underlying manual sortOrder, so a drop would silently apply the
   * sorted view's index gap to the real order and corrupt it. Reordering
   * only makes sense in Manual sort, so the handle is hidden and dragging
   * disabled otherwise.
   */
  dragDisabled?: boolean;
}

export default function TaskItem({
  task,
  showCompleted,
  selected,
  keyFocused = false,
  bulkSelected = false,
  onBulkToggle,
  onMutated,
  dragDisabled = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClick = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // Optimistic completion: the checkbox flips instantly on tap instead of
  // waiting on toggleComplete's DB round trip (subtask cascade + main update
  // + recurring-task spawn check, all sequential) plus whatever refresh
  // onMutated triggers — on mobile that chain is 2-3 stacked network round
  // trips, which read as the tap simply not registering. React reverts this
  // back to `task.completedAt` once the transition below settles.
  const [isComplete, setOptimisticComplete] = useOptimistic(
    task.completedAt !== null,
    (_prev: boolean, next: boolean) => next,
  );
  const [, startTransition] = useTransition();
  const hasSubtasks = task.subtaskCount > 0;
  // Uses the optimistic value (not task.completedAt) so a just-checked task's
  // overdue badge also clears immediately rather than lingering until refresh.
  const overdue = !isComplete && isOverdue(task.dueDate, null);
  const detailHref = `/tasks/${task.listId}?task=${task.id}`;

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      setOptimisticComplete(checked);
      await toggleComplete(task.id, task.listId, checked);
      onMutated();
    });
  }

  function clearLongPressTimer() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // pointerup/pointerleave/pointermove only clear the timer while the row is
  // still mounted and receiving those events — if the row unmounts mid-press
  // (its task is deleted/moved by a sync elsewhere while a finger is still
  // down), none of those fire, and the timeout would otherwise still call
  // onBulkToggle against a task that's no longer part of the current view.
  useEffect(() => clearLongPressTimer, []);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch' || !onBulkToggle) return;
    longPressTimer.current = setTimeout(() => {
      suppressNextClick.current = true;
      onBulkToggle(task.id);
    }, LONG_PRESS_MS);
  }

  function handleMainClick(e: React.MouseEvent) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      e.preventDefault();
      return;
    }
    if (onBulkToggle && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onBulkToggle(task.id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        styles.wrapper,
        selected ? styles.selected : '',
        bulkSelected ? styles.bulkSelected : '',
        keyFocused ? styles.keyFocused : '',
        isDragging ? styles.dragging : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!dragDisabled && (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      )}
      <div className={styles.row}>
        <Checkbox
          checked={isComplete}
          onChange={handleToggle}
          label=""
          aria-label={`Mark "${task.title}" ${isComplete ? 'incomplete' : 'complete'}`}
        />

        <Link
          href={detailHref}
          className={styles.main}
          onClick={handleMainClick}
          onPointerDown={handlePointerDown}
          onPointerUp={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onPointerMove={clearLongPressTimer}
        >
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
                  <Icon name="calendar" size="xs" aria-hidden />
                  {formatDueDate(task.dueDate, task.dueTime)}
                </span>
              )}
              {task.recurrenceRule && (
                <span className={styles.repeatIndicator}>
                  <Icon name="rotate-ccw" size="xs" aria-hidden />
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
