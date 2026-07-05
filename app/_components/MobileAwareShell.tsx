'use client';

import type { ReactNode } from 'react';
import { useIsMobile } from '../_lib/useIsMobile';
import type { ListRow } from '../_lib/types';
import ListSidebar from '../ListSidebar';
import MobileTasksCarousel from './MobileTasksCarousel';
import styles from '../layout.module.css';

interface Props {
  lists: ListRow[];
  children: ReactNode;
}

/**
 * Forks the plugin's root shell between the desktop/tablet three-column
 * layout (unchanged) and the mobile swipeable-lists carousel. This has to be
 * a client component — nothing else in the runtime picks a component tree
 * based on viewport in JS, since CSS media queries can't express "mount an
 * entirely different set of components."
 *
 * On mobile, `children` (page.tsx's server-rendered output for the current
 * route) is deliberately not rendered — MobileTasksCarousel manages its own
 * client-side data for every list so swiping between them is instant. It is
 * still passed through as `refreshSignal`: React re-invokes this component
 * with a new `children` reference on every server refresh (e.g. any
 * router.refresh() call inside TasksPane/TaskDetailPane/etc.), which the
 * carousel uses purely as a signal to re-fetch its active slide — see
 * MobileTasksCarousel's own doc comment.
 */
export default function MobileAwareShell({ lists, children }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={styles.shell} data-plugin-fullbleed>
        <MobileTasksCarousel lists={lists} refreshSignal={children} />
      </div>
    );
  }

  return (
    <div className={styles.shell} data-plugin-fullbleed>
      <aside className={styles.sidebar}>
        <ListSidebar lists={lists} />
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
