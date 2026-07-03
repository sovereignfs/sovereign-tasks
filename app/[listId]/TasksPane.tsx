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
import { Toggle } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import TaskItem from '../_components/TaskItem';
import { createTask, reorderTasks, updatePrefs } from '../_lib/actions';
import styles from './TasksPane.module.css';

interface ListRow {
  id: string;
  title: string;
}

interface TaskRow {
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
  list: ListRow;
  initialTasks: TaskRow[];
  showCompleted: boolean;
  listId: string;
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

export default function TasksPane({
  list,
  initialTasks,
  showCompleted: initialShowCompleted,
  listId,
}: Props) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState('');
  const [_isPending, startTransition] = useTransition();

  // The server component re-renders with fresh props after router.refresh(),
  // so the server-provided props are the source of truth. useOptimistic layers
  // pending mutations on top and automatically resets to the new base once the
  // transition settles — no manual prop→state syncing.
  const [tasks, applyTaskAction] = useOptimistic(initialTasks, tasksReducer);
  const [showCompleted, setOptimisticShowCompleted] = useOptimistic(
    initialShowCompleted,
    (_prev, next: boolean) => next,
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = showCompleted ? tasks : tasks.filter((t) => t.completedAt === null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
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
      // Optimistic placeholder — visible only for the duration of this pending
      // transition, then replaced by the real row (with its persisted id) when
      // router.refresh() lands. Not interactable long enough for its temp id to
      // reach a server action.
      applyTaskAction({
        type: 'add',
        task: {
          id: `optimistic-${Date.now()}`,
          listId,
          title: trimmed,
          notes: null,
          completedAt: null,
          parentId: null,
          subtaskCount: 0,
          subtaskDoneCount: 0,
        },
      });
      await createTask(listId, trimmed);
      router.refresh();
    });
  }

  function handleToggleShowCompleted(checked: boolean) {
    startTransition(async () => {
      setOptimisticShowCompleted(checked);
      await updatePrefs(listId, { showCompleted: checked });
      router.refresh();
    });
  }

  return (
    // suppressHydrationWarning: password-manager extensions (e.g. ProtonPass)
    // inject data-* attributes onto this div causing a benign server/client
    // attribute mismatch. Suppresses noise without hiding real bugs (children
    // are not affected).
    <div className={styles.pane} suppressHydrationWarning>
      <header className={styles.header}>
        <h1 className={styles.title}>{list.title}</h1>
        <div className={styles.toggleLabel}>
          <span className={styles.toggleText} id="show-completed-label">
            Show completed
          </span>
          <Toggle
            checked={showCompleted}
            onChange={handleToggleShowCompleted}
            aria-label="Show completed tasks"
            aria-labelledby="show-completed-label"
          />
        </div>
      </header>

      <div className={styles.addRow}>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.taskList}>
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                showCompleted={showCompleted}
                onMutated={refresh}
              />
            ))}
            {visible.length === 0 && (
              <p className={styles.empty}>
                {tasks.length === 0
                  ? 'No tasks yet — type above and press Enter to add one.'
                  : 'All done! Toggle "Show completed" to see finished tasks.'}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
