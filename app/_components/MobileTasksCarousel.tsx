'use client';

import { Drawer } from '@sovereignfs/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ListSidebar from '../ListSidebar';
import TasksPane from '../[listId]/TasksPane';
import { getOrCreatePrefs, getTask, getTasks } from '../_lib/actions';
import type { ListRow, TaskRow } from '../_lib/types';
import TaskDetailPane, { type DetailTask } from './TaskDetailPane';
import styles from './MobileTasksCarousel.module.css';

interface ListState {
  tasks: TaskRow[];
  showCompleted: boolean;
  status: 'loading' | 'loaded' | 'error';
}

interface Props {
  lists: ListRow[];
  /** Changes identity on every server re-render of the plugin's routes (i.e.
   *  whenever anything anywhere calls router.refresh()). This carousel's own
   *  data lives in client state, decoupled from page.tsx's server props (see
   *  MobileAwareShell's doc comment for why) — this is purely a signal to
   *  re-fetch the active slide, piggy-backing on the refresh calls already
   *  scattered through TasksPane/TaskDetailPane/etc. without touching them. */
  refreshSignal: unknown;
}

/** Slide index 0 is the Lists index; index n (n>=1) is lists[n-1]. */
function indexForPathname(pathname: string, lists: ListRow[]): number {
  const match = pathname.match(/^\/tasks\/([^/]+)/);
  if (match) {
    const idx = lists.findIndex((l) => l.id === match[1]);
    if (idx !== -1) return idx + 1;
  }
  // Bare /tasks, or a listId that no longer exists — land on the user's first
  // list rather than the index slide (matches the desktop sidebar + first
  // list being visible together; there's no "first list" concept to preserve
  // on desktop since both are already on screen at once).
  return lists.length > 0 ? 1 : 0;
}

export default function MobileTasksCarousel({ lists, refreshSignal }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didSyncInitialUrl = useRef(false);
  const isFirstRefreshSignal = useRef(true);

  const [activeIndex, setActiveIndex] = useState(() => indexForPathname(pathname, lists));
  const initialIndexRef = useRef(activeIndex);
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  const [listState, setListState] = useState<Record<string, ListState>>({});
  const [detailTask, setDetailTask] = useState<DetailTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeList = activeIndex > 0 ? (lists[activeIndex - 1] ?? null) : null;
  const taskIdParam = searchParams.get('task');

  const loadList = useCallback(async (listId: string) => {
    setListState((s) => ({
      ...s,
      [listId]: {
        tasks: s[listId]?.tasks ?? [],
        showCompleted: s[listId]?.showCompleted ?? false,
        status: 'loading',
      },
    }));
    try {
      const [tasks, prefs] = await Promise.all([getTasks(listId), getOrCreatePrefs(listId)]);
      setListState((s) => ({
        ...s,
        [listId]: { tasks, showCompleted: prefs?.showCompleted ?? false, status: 'loaded' },
      }));
    } catch {
      setListState((s) => ({
        ...s,
        [listId]: { tasks: [], showCompleted: false, status: 'error' },
      }));
    }
  }, []);

  // Fetch the active slide plus its immediate neighbors — a single swipe
  // never shows a loading spinner since the destination is already cached.
  useEffect(() => {
    const neighbors = [activeIndex - 1, activeIndex, activeIndex + 1]
      .map((i) => lists[i - 1])
      .filter((l): l is ListRow => !!l);
    for (const l of neighbors) {
      if (!listState[l.id]) loadList(l.id);
    }
    // listState intentionally excluded from deps — it's the effect's own
    // output (loadList's setListState calls), not an input that should retrigger it.
  }, [activeIndex, lists, loadList]);

  // Re-fetch the active list whenever a mutation elsewhere triggers a server
  // refresh (see refreshSignal's doc comment above). Skips the first fire,
  // which coincides with the initial mount already covered by the effect above.
  useEffect(() => {
    if (isFirstRefreshSignal.current) {
      isFirstRefreshSignal.current = false;
      return;
    }
    if (activeList) loadList(activeList.id);
    // Intentionally only keyed on refreshSignal — activeList/loadList are
    // read at fire-time, not triggers for re-running this effect themselves.
  }, [refreshSignal]);

  // Cold-load at the bare /tasks route: sync the URL to the first list once,
  // so a refresh/share-link lands consistently with what's on screen.
  useEffect(() => {
    if (didSyncInitialUrl.current) return;
    didSyncInitialUrl.current = true;
    const first = lists[0];
    if (pathname === '/tasks' && first) {
      router.replace(`/tasks/${first.id}`, { scroll: false });
    }
  }, [pathname, lists, router]);

  // Initial scroll position, once — subsequent activeIndex changes come from
  // the user's own scroll gesture and must not be fought with a re-snap.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: initialIndexRef.current * el.clientWidth, behavior: 'instant' });
  }, []);

  // Re-align on viewport resize (e.g. orientation change) so the active
  // slide stays framed correctly.
  useEffect(() => {
    function handleResize() {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ left: activeIndex * el.clientWidth, behavior: 'instant' });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeIndex]);

  // Debounced "settled" detection — avoids depending on the newer `scrollend`
  // event, which pre-17.4 iOS Safari/WKWebView (still in use per this
  // plugin's own iOS PWA history) doesn't support.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        const current = scrollRef.current;
        if (!current) return;
        const width = current.clientWidth;
        if (!width) return;
        const newIndex = Math.round(current.scrollLeft / width);
        if (newIndex === activeIndexRef.current) return;
        setActiveIndex(newIndex);
        const newList = newIndex > 0 ? lists[newIndex - 1] : null;
        router.replace(newList ? `/tasks/${newList.id}` : '/tasks', { scroll: false });
      }, 120);
    }
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [lists, router]);

  // Task detail sheet: driven by the ?task= param, same convention as desktop.
  useEffect(() => {
    if (!taskIdParam) {
      setDetailTask(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getTask(taskIdParam)
      .then((t) => {
        if (!cancelled) {
          setDetailTask(t as DetailTask | null);
          setDetailLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailTask(null);
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [taskIdParam, refreshSignal]);

  function closeDetail() {
    const params = new URLSearchParams(searchParams);
    params.delete('task');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  // Guard against a stale ?task from a different list, same as page.tsx does.
  const validDetailTask = detailTask && detailTask.listId === activeList?.id ? detailTask : null;
  const showDrawer = !!taskIdParam && (detailLoading || validDetailTask !== null);

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller} ref={scrollRef}>
        <div className={styles.slide}>
          <ListSidebar lists={lists} />
        </div>
        {lists.map((list) => {
          const state = listState[list.id];
          return (
            <div className={styles.slide} key={list.id}>
              {state && state.status !== 'loading' ? (
                <TasksPane
                  list={list}
                  lists={lists}
                  initialTasks={state.tasks}
                  showCompleted={state.showCompleted}
                  listId={list.id}
                  selectedTaskId={validDetailTask?.id ?? null}
                />
              ) : (
                <div className={styles.slideLoading}>Loading…</div>
              )}
            </div>
          );
        })}
      </div>

      {lists.length > 0 && (
        <div className={styles.dots} aria-hidden>
          {['index', ...lists.map((l) => l.id)].map((key, i) => (
            <span
              key={key}
              className={[styles.dot, i === activeIndex ? styles.dotActive : ''].join(' ')}
            />
          ))}
        </div>
      )}

      <Drawer open={showDrawer} onClose={closeDetail} aria-label="Task details">
        {validDetailTask && activeList ? (
          <TaskDetailPane task={validDetailTask} listId={activeList.id} lists={lists} />
        ) : (
          <div className={styles.slideLoading}>Loading…</div>
        )}
      </Drawer>
    </div>
  );
}
