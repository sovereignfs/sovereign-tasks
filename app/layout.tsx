import type { ReactNode } from 'react';
import { getLists } from '../lib/actions';
import ListSidebar from './ListSidebar';
import styles from './layout.module.css';

export default async function TasksLayout({ children }: { children: ReactNode }) {
  const lists = await getLists();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <ListSidebar lists={lists} />
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
