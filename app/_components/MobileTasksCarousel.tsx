'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ListSidebar from '../ListSidebar';
import TasksPane from '../[listId]/TasksPane';
import { getOrCreatePrefs, getTask, getTasks } from '../_lib/actions';
import type { ListRow, TaskRow } from '../_lib/types';
import MobileFullPageOverlay from './MobileFullPageOverlay';
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
  // Set right before the scroll-settle handler below calls router.replace, so
  // the pathname-sync effect can tell "this pathname change is the carousel's
  // own settle, already reflected in activeIndex" apart from a genuinely
  // external navigation (a tapped <Link>, browser back/forward, a bookmark).
  // Needed specifically because indexForPathname can't distinguish those two
  // cases for a bare `/tasks` pathname: settling on slide 0 (Lists index)
  // produces the same pathname as a fresh cold load, whose fallback prefers
  // the first list (index 1) — without this flag, settling on slide 0 was
  // immediately overridden back to index 1 once the router's pathname state
  // caught up a render or two later.
  const isInternalNav = useRef(false);

  const [activeIndex, setActiveIndex] = useState(() => indexForPathname(pathname, lists));
  const initialIndexRef = useRef(activeIndex);
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  const [listState, setListState] = useState<Record<string, ListState>>({});
  const [detailTask, setDetailTask] = useState<DetailTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // True while ListSidebar's own "Edit list" full-page sheet is open on the
  // Lists index slide — see ListSidebar's onEditingChange doc comment.
  const [listEditingOpen, setListEditingOpen] = useState(false);

  const activeList = activeIndex > 0 ? (lists[activeIndex - 1] ?? null) : null;
  const taskIdParam = searchParams.get('task');

  const loadList = useCallback(async (listId: string) => {
    setListState((s) => {
      const existing = s[listId];
      // A background refresh (e.g. router.refresh() after toggling a
      // checkbox re-fires this for the active slide via the refreshSignal
      // effect below) should keep showing the already-loaded tasks while
      // the refetch happens, not flip back to the "Loading…" placeholder —
      // that unmounts and remounts TasksPane, which was the source of a
      // visible flicker on every mutation, and (combined with the cold-load
      // effect's router.replace also re-firing this for the same list right
      // after the initial mount fetch) a double flicker on first open.
      // 'loading' is reserved for a list's genuine first-ever fetch.
      const status = existing?.status === 'loaded' ? 'loaded' : 'loading';
      return {
        ...s,
        [listId]: {
          tasks: existing?.tasks ?? [],
          showCompleted: existing?.showCompleted ?? false,
          status,
        },
      };
    });
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

  // Synchronously patches this carousel's own decoupled task caches the
  // moment an optimistic toggle (completion, star) fires inside a slide —
  // see StarButton's onOptimisticChange doc comment for why. Without this,
  // listState/detailTask stay stale until loadList's/the detailTask effect's
  // own refetch (triggered by refreshSignal, some time after this same
  // toggle's transition has already settled) eventually catches up, causing
  // a visible revert-then-reapply flicker back to the old value.
  const patchTask = useCallback((taskListId: string, taskId: string, patch: Partial<TaskRow>) => {
    setListState((s) => {
      const entry = s[taskListId];
      if (!entry) return s;
      return {
        ...s,
        [taskListId]: {
          ...entry,
          tasks: entry.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        },
      };
    });
  }, []);

  const patchDetailTask = useCallback((patch: Partial<DetailTask>) => {
    setDetailTask((t) => (t ? { ...t, ...patch } : t));
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

  // Sync to the pathname whenever it changes for a reason other than the
  // carousel's own scroll-settle handler below — e.g. tapping a list row's
  // <Link> on the Lists index slide (ListSidebar), which navigates but never
  // touches scrollLeft itself.
  //
  // Can't rely solely on comparing newIndex to activeIndexRef here: settling
  // on slide 0 (the Lists index) also replaces the URL to the bare `/tasks`
  // pathname, which indexForPathname can't tell apart from a fresh cold
  // load — its fallback for that exact pathname prefers the first list
  // (index 1), not index 0. Once Next's router state caught up with that
  // replace a render later, this effect saw pathname go from `/tasks/x` to
  // `/tasks`, recomputed newIndex as 1 via the fallback, and smooth-scrolled
  // straight back to the first list a moment after the user had swiped away
  // from it. isInternalNav (set right before that specific router.replace)
  // marks the change as already accounted for and skips this resync once.
  const didMountPathSync = useRef(false);
  useEffect(() => {
    if (!didMountPathSync.current) {
      didMountPathSync.current = true;
      return;
    }
    if (isInternalNav.current) {
      isInternalNav.current = false;
      return;
    }
    const newIndex = indexForPathname(pathname, lists);
    if (newIndex === activeIndexRef.current) return;
    setActiveIndex(newIndex);
    scrollRef.current?.scrollTo({ left: newIndex * scrollRef.current.clientWidth, behavior: 'smooth' });
  }, [pathname, lists]);

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
        isInternalNav.current = true;
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

  // While getTask() above is in flight, the tapped task's summary fields are
  // already sitting in this same list's cached tasks (whatever TaskItem the
  // user just tapped rendered from) — everything DetailTask needs except
  // seriesId, which useEditScope only reads at the moment of a later commit
  // (not captured once at mount), so a temporary null there is harmless.
  // Rendering this immediately instead of a bare "Loading…" placeholder is
  // what removes the layout jump right after the overlay opens — the content
  // is full-sized from the first frame, and swapping in the authoritative
  // fetch afterwards is an invisible, same-shape update, not a remount
  // (TaskDetailPane's inner DetailBody is keyed by task.id, which doesn't
  // change between the optimistic and authoritative versions).
  const optimisticDetailTask: DetailTask | null =
    !validDetailTask && taskIdParam && activeList
      ? (() => {
          const t = listState[activeList.id]?.tasks.find((task) => task.id === taskIdParam);
          return t ? { ...t, seriesId: null } : null;
        })()
      : null;
  const displayDetailTask = validDetailTask ?? optimisticDetailTask;
  const showDetailOverlay = !!taskIdParam && (detailLoading || displayDetailTask !== null);
  // Dots represent position within the slide carousel — meaningless (and,
  // without this, visible on top of) either full-page sheet, which covers
  // the whole carousel rather than being one of its slides.
  const showDots = lists.length > 0 && !showDetailOverlay && !listEditingOpen;

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller} ref={scrollRef}>
        <div className={styles.slide}>
          <ListSidebar lists={lists} onEditingChange={setListEditingOpen} />
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
                  selectedTaskId={displayDetailTask?.id ?? null}
                  onTaskFieldPatch={(taskId, patch) => patchTask(list.id, taskId, patch)}
                />
              ) : (
                <div className={styles.slideLoading}>Loading…</div>
              )}
            </div>
          );
        })}
      </div>

      {showDots && (
        <div className={styles.dots} aria-hidden>
          {['index', ...lists.map((l) => l.id)].map((key, i) => (
            <span
              key={key}
              className={[styles.dot, i === activeIndex ? styles.dotActive : ''].join(' ')}
            />
          ))}
        </div>
      )}

      <MobileFullPageOverlay open={showDetailOverlay} onClose={closeDetail} aria-label="Task details">
        {displayDetailTask && activeList ? (
          <TaskDetailPane
            task={displayDetailTask}
            listId={activeList.id}
            lists={lists}
            onFieldPatch={patchDetailTask}
          />
        ) : (
          <div className={styles.slideLoading}>Loading…</div>
        )}
      </MobileFullPageOverlay>
    </div>
  );
}
