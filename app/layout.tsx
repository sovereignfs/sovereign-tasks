import type { ReactNode } from 'react';
import MobileAwareShell from './_components/MobileAwareShell';
import { countStarredTasks, getLists } from './_lib/actions';

export default async function TasksLayout({ children }: { children: ReactNode }) {
  const [lists, starredCount] = await Promise.all([getLists(), countStarredTasks()]);

  return (
    <MobileAwareShell lists={lists} starredCount={starredCount}>
      {children}
    </MobileAwareShell>
  );
}
