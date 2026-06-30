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
import { useState, useTransition } from 'react';
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
}

interface Props {
  list: ListRow;
  initialTasks: TaskRow[];
  showCompleted: boolean;
  listId: string;
}

export default function TasksPane({ list, initialTasks, showCompleted: initialShowCompleted, listId }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showCompleted, setShowCompleted] = useState(initialShowCompleted);
  const [newTitle, setNewTitle] = useState('');
  const [_isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = showCompleted ? tasks : tasks.filter((t) => t.completedAt === null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    setTasks(reordered);
    await reorderTasks(listId, reordered.map((t) => t.id));
  }

  async function handleAddTask() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await createTask(listId, trimmed);
    setNewTitle('');
    refresh();
  }

  async function handleToggleShowCompleted(checked: boolean) {
    setShowCompleted(checked);
    await updatePrefs(listId, { showCompleted: checked });
  }

  return (
    <div className={styles.pane}>
      <header className={styles.header}>
        <h1 className={styles.title}>{list.title}</h1>
        <div className={styles.toggleLabel}>
          <span className={styles.toggleText} id="show-completed-label">Show completed</span>
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
          placeholder="Add a task…"
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
          </div>
        </SortableContext>
      </DndContext>

      {visible.length === 0 && (
        <p className={styles.empty}>
          {showCompleted ? 'No tasks yet. Add one above.' : 'All done! Toggle to see completed tasks.'}
        </p>
      )}
    </div>
  );
}
