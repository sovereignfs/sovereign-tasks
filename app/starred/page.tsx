import TaskDetailPane from '../_components/TaskDetailPane';
import { getLists, getStarredTasks, getTask } from '../_lib/actions';
import { STARRED_LIST_ID } from '../_lib/virtualLists';
import TasksPane from '../[listId]/TasksPane';
import styles from '../[listId]/page.module.css';

interface Props {
  searchParams: Promise<{ task?: string }>;
}

/** Desktop route for the virtual "Starred" view (TSK-28) — mirrors
 *  `[listId]/page.tsx`'s three-column shell (sidebar comes from the shared
 *  layout), but sources its tasks from getStarredTasks() instead of a real
 *  list, and passes TasksPane virtualList="starred" to strip the
 *  list-management affordances that don't apply to an aggregated view. */
export default async function StarredPage({ searchParams }: Props) {
  const { task: taskId } = await searchParams;

  const [lists, tasks, selectedTask] = await Promise.all([
    getLists(),
    getStarredTasks(),
    taskId ? getTask(taskId).catch(() => null) : Promise.resolve(null),
  ]);

  // A starred task's detail pane is reachable from here regardless of which
  // real list it lives in — no "stale list" guard needed, unlike
  // [listId]/page.tsx (there's no listId param to mismatch against).
  const detailTask = selectedTask;

  const starredList = {
    id: STARRED_LIST_ID,
    title: 'Starred',
    color: null,
    openCount: tasks.filter((t) => t.completedAt === null).length,
  };

  return (
    <div className={styles.inner}>
      <div className={styles.listCol}>
        <TasksPane
          list={starredList}
          lists={lists}
          initialTasks={tasks}
          showCompleted={false}
          listId={STARRED_LIST_ID}
          selectedTaskId={detailTask ? detailTask.id : null}
          virtualList="starred"
        />
      </div>
      <aside className={styles.detailCol}>
        <TaskDetailPane task={detailTask} listId={STARRED_LIST_ID} lists={lists} />
      </aside>
    </div>
  );
}
