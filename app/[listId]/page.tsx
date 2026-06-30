import { notFound } from 'next/navigation';
import { getLists, getTasks, getOrCreatePrefs } from '../../lib/actions';
import TasksPane from './TasksPane';

interface Props {
  params: Promise<{ listId: string }>;
}

export default async function ListPage({ params }: Props) {
  const { listId } = await params;

  const [lists, tasks, prefs] = await Promise.all([
    getLists(),
    getTasks(listId).catch(() => null),
    getOrCreatePrefs(listId),
  ]);

  if (tasks === null) notFound();

  const list = lists.find((l: { id: string; title: string }) => l.id === listId);
  if (!list) notFound();

  return (
    <TasksPane
      list={list}
      initialTasks={tasks}
      showCompleted={prefs?.showCompleted ?? false}
      listId={listId}
    />
  );
}
