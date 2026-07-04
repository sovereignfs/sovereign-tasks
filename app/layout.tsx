import type { ReactNode } from 'react';
import { getLists } from './_lib/actions';
import ListSidebar from './ListSidebar';
import styles from './layout.module.css';

export default async function TasksLayout({ children }: { children: ReactNode }) {
  const lists = await getLists();

  return (
    <div className={styles.shell} data-plugin-fullbleed>
      <aside className={styles.sidebar}>
        <ListSidebar lists={lists} />
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
