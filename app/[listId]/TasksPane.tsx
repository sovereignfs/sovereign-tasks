'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SegmentedControl } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import TaskItem from '../_components/TaskItem';
import { createTask, reorderTasks, updatePrefs } from '../_lib/actions';
import { isOverdue } from '../_lib/date';
import { listDotColor } from '../_lib/colors';
import type { ListRow, TaskRow } from '../_lib/types';
import styles from './TasksPane.module.css';

type Filter = 'all' | 'active' | 'overdue';

interface Props {
  list: ListRow;
  initialTasks: TaskRow[];
  showCompleted: boolean;
  listId: string;
  selectedTaskId: string | null;
}

type TaskAction = { type: 'add'; task: TaskRow } | { type: 'reorder'; ids: string[] };

function tasksReducer(state: TaskRow[], action: TaskAction): TaskRow[] {
  switch (action.type) {
    case 'add':
      return [...state, action.task];
    case 'reorder': {
      const byId = new Map(state.map((t) => [t.id, t]));
      return action.ids.map((id) => byId.get(id)).filter((t): t is TaskRow => t !== undefined);
    }
  }
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
];

export default function TasksPane({
  list,
  initialTasks,
  showCompleted: initialShowCompleted,
  listId,
  selectedTaskId,
}: Props) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [_isPending, startTransition] = useTransition();

  const [tasks, applyTaskAction] = useOptimistic(initialTasks, tasksReducer);
  const [completedOpen, setCompletedOpen] = useOptimistic(
    initialShowCompleted,
    (_prev, next: boolean) => next,
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const active = tasks.filter((t) => t.completedAt === null);
  const activeVisible =
    filter === 'overdue' ? active.filter((t) => isOverdue(t.dueDate, t.completedAt)) : active;
  const completed = tasks.filter((t) => t.completedAt !== null);
  const showCompletedSection = filter !== 'overdue' && completed.length > 0;
  const completedExpanded = filter === 'all' || completedOpen;

  function refresh() {
    startTransition(() => router.refresh());
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === a.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const ids = arrayMove(tasks, oldIndex, newIndex).map((t) => t.id);
    startTransition(async () => {
      applyTaskAction({ type: 'reorder', ids });
      await reorderTasks(listId, ids);
      router.refresh();
    });
  }

  function handleAddTask() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle('');
    startTransition(async () => {
      applyTaskAction({
        type: 'add',
        task: {
          id: `optimistic-${Date.now()}`,
          listId,
          title: trimmed,
          notes: null,
          completedAt: null,
          parentId: null,
          favorite: false,
          dueDate: null,
          dueTime: null,
          recurrenceRule: null,
          subtaskCount: 0,
          subtaskDoneCount: 0,
        },
      });
      await createTask(listId, trimmed);
      router.refresh();
    });
  }

  function toggleCompletedSection() {
    const next = !completedOpen;
    startTransition(async () => {
      setCompletedOpen(next);
      await updatePrefs(listId, { showCompleted: next });
      router.refresh();
    });
  }

  return (
    <div className={styles.pane} suppressHydrationWarning>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.dot} style={{ background: listDotColor(list.color) }} aria-hidden />
          <h1 className={styles.title}>{list.title}</h1>
          <span className={styles.count}>
            {active.length} {active.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={FILTERS}
          size="sm"
          aria-label="Filter tasks"
        />
      </header>

      <div className={styles.addRow}>
        <span className={styles.addPlus} aria-hidden>
          +
        </span>
        <input
          className={styles.addInput}
          placeholder="Add a task and press Enter…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddTask();
          }}
        />
      </div>

      <DndContext
        id="tasks-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeVisible.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.taskList}>
            {activeVisible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                showCompleted={completedExpanded}
                selected={task.id === selectedTaskId}
                onMutated={refresh}
              />
            ))}
            {activeVisible.length === 0 && (
              <p className={styles.empty}>
                {filter === 'overdue'
                  ? 'Nothing overdue.'
                  : tasks.length === 0
                    ? 'No tasks yet — type above and press Enter to add one.'
                    : 'All done! Completed tasks are below.'}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {showCompletedSection && (
        <div className={styles.completed}>
          <button
            type="button"
            className={styles.completedHeader}
            aria-expanded={completedExpanded}
            onClick={toggleCompletedSection}
          >
            <span>Completed</span>
            <span className={styles.completedCount}>· {completed.length}</span>
            <span className={styles.completedChevron}>{completedExpanded ? '▴' : '▾'}</span>
          </button>
          {completedExpanded && (
            <div className={styles.taskList}>
              {completed.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  showCompleted
                  selected={task.id === selectedTaskId}
                  onMutated={refresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
