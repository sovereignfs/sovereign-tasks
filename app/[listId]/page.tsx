import { notFound } from 'next/navigation';
import TaskDetailPane from '../_components/TaskDetailPane';
import { getLists, getOrCreatePrefs, getTask, getTasks } from '../_lib/actions';
import TasksPane from './TasksPane';
import styles from './page.module.css';

interface Props {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ task?: string }>;
}

export default async function ListPage({ params, searchParams }: Props) {
  const { listId } = await params;
  const { task: taskId } = await searchParams;

  const [lists, tasks, prefs, selectedTask] = await Promise.all([
    getLists(),
    getTasks(listId).catch(() => null),
    getOrCreatePrefs(listId),
    taskId ? getTask(taskId).catch(() => null) : Promise.resolve(null),
  ]);

  if (tasks === null) notFound();
  const list = lists.find((l) => l.id === listId);
  if (!list) notFound();

  // Guard against a stale ?task from a different list.
  const detailTask = selectedTask && selectedTask.listId === listId ? selectedTask : null;

  return (
    <div className={styles.inner}>
      <div className={styles.listCol}>
        <TasksPane
          list={list}
          lists={lists}
          initialTasks={tasks}
          showCompleted={prefs?.showCompleted ?? false}
          listId={listId}
          selectedTaskId={detailTask ? detailTask.id : null}
        />
      </div>
      <aside className={styles.detailCol}>
        <TaskDetailPane task={detailTask} listId={listId} lists={lists} />
      </aside>
    </div>
  );
}
