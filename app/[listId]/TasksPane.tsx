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
import { Button, Icon, Popover, SegmentedControl } from '@sovereignfs/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import BulkActionBar from '../_components/BulkActionBar';
import TaskItem from '../_components/TaskItem';
import {
  bulkDeleteTasks,
  bulkMoveTasks,
  createTask,
  deleteList,
  reorderTasks,
  toggleComplete,
  updateList,
  updatePrefs,
} from '../_lib/actions';
import { isOverdue } from '../_lib/date';
import { listDotColor } from '../_lib/colors';
import { measureTextWidth } from '../_lib/measureText';
import { SORT_OPTIONS, sortTasks, type SortBy } from '../_lib/sort';
import { useIsMobile } from '../_lib/useIsMobile';
import type { ListRow, TaskRow } from '../_lib/types';
import styles from './TasksPane.module.css';

type Filter = 'all' | 'active' | 'overdue';

interface Props {
  list: ListRow;
  lists: ListRow[];
  initialTasks: TaskRow[];
  showCompleted: boolean;
  listId: string;
  selectedTaskId: string | null;
}

// Elements that should swallow single-letter shortcuts because the user is
// typing into them (TSK-19 — shortcuts only fire when focus isn't in a field).
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type TaskAction = { type: 'add'; task: TaskRow } | { type: 'reorder'; ids: string[] };

function tasksReducer(state: TaskRow[], action: TaskAction): TaskRow[] {
  switch (action.type) {
    case 'add':
      return [...state, action.task];
    case 'reorder': {
      const byId = new Map(state.map((t) => [t.id, t]));
      return action.ids.map((id) => byId.get(id)).filter((t): t is TaskRow => t !== undefined);
    }
  }
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
];

export default function TasksPane({
  list,
  lists,
  initialTasks,
  showCompleted: initialShowCompleted,
  listId,
  selectedTaskId,
}: Props) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [_isPending, startTransition] = useTransition();
  const addInputRef = useRef<HTMLInputElement>(null);

  // Rename-via-double-click on the title stays desktop only — there's no
  // touch equivalent of a double-click, so mobile keeps renaming through
  // ListSidebar's own actions Drawer on the Lists index slide instead (see
  // CLAUDE.md's "Mobile shell" section). The header options menu (Filter
  // when folded, Sort by, Delete list) below is shared with mobile — same
  // responsive inline-vs-menu logic on both, since mobile screens are just a
  // narrower case of the same "does Filter fit next to the title" question.
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState(list.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // Pixel-accurate width for the rename input (see _lib/measureText) — a
  // `ch`-unit estimate looked visibly too wide for this font/weight and
  // space-heavy titles. Re-measured on every keystroke against the input's
  // own computed font, so it grows/shrinks live instead of jumping once on
  // entering edit mode.
  const [renameInputWidth, setRenameInputWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!renaming) return;
    const el = renameInputRef.current;
    if (!el) return;
    const width = measureTextWidth(renameTitle || ' ', el);
    if (width !== null) setRenameInputWidth(width + 4);
  }, [renaming, renameTitle]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('manual');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [deleteCompletedOpen, setDeleteCompletedOpen] = useState(false);
  const deleteCompletedDialogRef = useRef<HTMLDialogElement>(null);

  // Whether Filter fits inline in the title row (next to the options menu)
  // instead of folding into that menu. Measured against a hidden "shadow"
  // copy of the fully-inline row (same markup/classes, position: absolute +
  // visibility: hidden so it never affects real layout or a11y) rather than
  // manually summing up dot/title/count/filter/menu widths plus gaps by
  // hand — the shadow row lets the browser's own layout do that arithmetic,
  // so it stays correct even if gaps/padding change later. Defaults to false
  // (menu-only) for SSR/first paint, matching useIsMobile's own safe-default
  // pattern, then corrected once the client can actually measure. The effect
  // itself is below, after `active` (one of its dependencies) is computed.
  const [filterFitsInline, setFilterFitsInline] = useState(false);
  const titleRowRef = useRef<HTMLDivElement>(null);
  const shadowRowRef = useRef<HTMLDivElement>(null);

  const [tasks, applyTaskAction] = useOptimistic(initialTasks, tasksReducer);
  const [completedOpen, setCompletedOpen] = useOptimistic(
    initialShowCompleted,
    (_prev, next: boolean) => next,
  );

  // TSK-19 — keyboard row focus (j/k/Up/Down), independent of `selectedTaskId`
  // (the task open in the detail pane).
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // TSK-20/21 — bulk selection (ctrl/cmd-click or long-press on a row).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const active = tasks.filter((t) => t.completedAt === null);

  useEffect(() => {
    const row = titleRowRef.current;
    const shadow = shadowRowRef.current;
    if (!row || !shadow) return;

    function recompute() {
      if (!row || !shadow) return;
      setFilterFitsInline(shadow.offsetWidth <= row.clientWidth);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(row);
    return () => ro.disconnect();
  }, [list.title, active.length]);

  const activeFiltered =
    filter === 'overdue' ? active.filter((t) => isOverdue(t.dueDate, t.completedAt)) : active;
  // 'all' shows every task — completed included — together in the main
  // list, in place, instead of splitting completed ones off into the
  // separate collapsible section below. Marking a task done while viewing
  // "All" should leave it exactly where it is, not move it anywhere.
  const activeVisible = sortTasks(filter === 'all' ? tasks : activeFiltered, sortBy);
  const completed = sortTasks(
    tasks.filter((t) => t.completedAt !== null),
    sortBy,
  );
  // The separate section only makes sense for 'active' (where completed
  // tasks are otherwise hidden from the main list) — 'overdue' excludes
  // completed tasks by definition, and 'all' already shows them inline above.
  const showCompletedSection = filter === 'active' && completed.length > 0;
  const completedExpanded = filter === 'all' || completedOpen;

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  // Native <dialog> for the delete confirmation — mirrors ListSidebar's
  // pattern (sized to content, unlike @sovereignfs/ui's Dialog which is a
  // fixed-size box by design for tabbed/multi-view content).
  useEffect(() => {
    const el = deleteDialogRef.current;
    if (!el) return;
    if (deleteOpen) el.showModal();
    else el.close();
  }, [deleteOpen]);

  useEffect(() => {
    const el = deleteDialogRef.current;
    if (!el) return;
    const handleClose = () => setDeleteOpen(false);
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, []);

  // Same native <dialog> pattern, for confirming "Delete completed tasks".
  useEffect(() => {
    const el = deleteCompletedDialogRef.current;
    if (!el) return;
    if (deleteCompletedOpen) el.showModal();
    else el.close();
  }, [deleteCompletedOpen]);

  useEffect(() => {
    const el = deleteCompletedDialogRef.current;
    if (!el) return;
    const handleClose = () => setDeleteCompletedOpen(false);
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, []);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function startRename() {
    setRenameTitle(list.title);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = renameTitle.trim();
    setRenaming(false);
    if (trimmed && trimmed !== list.title) {
      startTransition(async () => {
        await updateList(listId, trimmed);
        router.refresh();
      });
    }
  }

  function cancelRename() {
    setRenameTitle(list.title);
    setRenaming(false);
  }

  function confirmDeleteList() {
    setDeleteOpen(false);
    startTransition(async () => {
      await deleteList(listId);
      router.push('/tasks');
      router.refresh();
    });
  }

  // Reuses bulkDeleteTasks (already tenant-scoped, cascades to subtasks) —
  // completed already holds every completed task in this list regardless of
  // the current filter, so no separate server action is needed just to
  // scope "delete completed" down to one list.
  function confirmDeleteCompleted() {
    setDeleteCompletedOpen(false);
    const ids = completed.map((t) => t.id);
    startTransition(async () => {
      await bulkDeleteTasks(ids, listId);
      router.refresh();
    });
  }

  function toggleBulkSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function clearBulkSelect() {
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    const ids = [...selectedIds];
    clearBulkSelect();
    startTransition(async () => {
      await bulkDeleteTasks(ids, listId);
      router.refresh();
    });
  }

  function handleBulkMove(toListId: string) {
    const ids = [...selectedIds];
    clearBulkSelect();
    startTransition(async () => {
      await bulkMoveTasks(ids, listId, toListId);
      router.refresh();
    });
  }

  // TSK-19 — keyboard shortcuts. Skipped while typing in a field, so they
  // never fight with normal text entry (add-task input, notes, renames…).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        clearBulkSelect();
        return;
      }

      if (e.key === 'n') {
        e.preventDefault();
        addInputRef.current?.focus();
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'k' || e.key === 'ArrowUp') {
        if (activeVisible.length === 0) return;
        e.preventDefault();
        const down = e.key === 'j' || e.key === 'ArrowDown';
        const currentIndex = activeVisible.findIndex((t) => t.id === focusedId);
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(Math.max(currentIndex + (down ? 1 : -1), 0), activeVisible.length - 1);
        setFocusedId(activeVisible[nextIndex]?.id ?? null);
        return;
      }

      if (e.key === 'e' && focusedId) {
        const task = activeVisible.find((t) => t.id === focusedId);
        if (!task) return;
        e.preventDefault();
        startTransition(async () => {
          await toggleComplete(task.id, task.listId, true);
          router.refresh();
        });
        return;
      }

      if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        router.push(`/tasks/${listId}?task=${focusedId}`);
        return;
      }

      if (e.key === '[' || e.key === ']') {
        if (lists.length < 2) return;
        const currentIndex = lists.findIndex((l) => l.id === listId);
        if (currentIndex === -1) return;
        e.preventDefault();
        const delta = e.key === ']' ? 1 : -1;
        const nextIndex = (currentIndex + delta + lists.length) % lists.length;
        const target = lists[nextIndex];
        if (target) router.push(`/tasks/${target.id}`);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVisible, focusedId, listId, lists, router, selectedIds.size, startTransition]);

  function handleDragEnd(event: DragEndEvent) {
    // Guards the same invariant as TaskItem's dragDisabled prop (which hides
    // the handle) — belt and suspenders, since old/newIndex below are looked
    // up against `tasks` (manual order), not the sorted `activeVisible`/
    // `completed` arrays dnd-kit actually rendered handles for.
    if (sortBy !== 'manual') return;
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === a.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const ids = arrayMove(tasks, oldIndex, newIndex).map((t) => t.id);
    startTransition(async () => {
      applyTaskAction({ type: 'reorder', ids });
      await reorderTasks(listId, ids);
      router.refresh();
    });
  }

  function handleAddTask() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle('');
    startTransition(async () => {
      applyTaskAction({
        type: 'add',
        task: {
          id: `optimistic-${Date.now()}`,
          listId,
          title: trimmed,
          notes: null,
          completedAt: null,
          parentId: null,
          favorite: false,
          dueDate: null,
          dueTime: null,
          recurrenceRule: null,
          createdAt: Math.floor(Date.now() / 1000),
          subtaskCount: 0,
          subtaskDoneCount: 0,
        },
      });
      await createTask(listId, trimmed);
      router.refresh();
    });
  }

  function toggleCompletedSection() {
    const next = !completedOpen;
    startTransition(async () => {
      setCompletedOpen(next);
      await updatePrefs(listId, { showCompleted: next });
      router.refresh();
    });
  }

  return (
    <div className={styles.pane} suppressHydrationWarning>
      <header className={styles.header}>
        <div className={styles.titleRow} ref={titleRowRef}>
          <span className={styles.dot} style={{ background: listDotColor(list.color) }} aria-hidden />
          {renaming ? (
            <input
              ref={renameInputRef}
              className={styles.titleInput}
              // Pixel-measured width (see the useLayoutEffect above) instead
              // of stretching to fill the row — keeps the input close to the
              // title's own footprint while editing, matching how it looked
              // as plain text. Falls back to a ch-based guess only for the
              // very first paint, before the layout effect has measured
              // anything yet.
              style={{ width: renameInputWidth ?? `${renameTitle.length + 2}ch` }}
              value={renameTitle}
              aria-label={`Rename "${list.title}"`}
              onChange={(e) => setRenameTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') cancelRename();
              }}
            />
          ) : (
            // Double-click-to-rename is a mouse-only convenience affordance
            // layered on top of a plain, fully-readable heading — there's no
            // separate keyboard-accessible rename entry point by design
            // (matches ListSidebar's identical row-title pattern). Same
            // e.detail === 2 trick: desktop only; mobile renames through the
            // sidebar's Drawer instead.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
            <h1
              className={styles.title}
              onClick={(e) => {
                if (!isMobile && e.detail === 2) startRename();
              }}
            >
              {list.title}
            </h1>
          )}
          <span className={styles.count}>
            {active.length} {active.length === 1 ? 'task' : 'tasks'}
          </span>
          <span className={styles.spacer} aria-hidden />
          {/* Filter renders inline here (next to the menu) when
              filterFitsInline says there's room for it — otherwise it folds
              into the menu below instead, so it's never lost, just relocated
              depending on available space and title length. Same logic on
              mobile as desktop; a mobile screen just hits the "doesn't fit"
              branch more often. */}
          {filterFitsInline && (
            <SegmentedControl<Filter>
              value={filter}
              onChange={setFilter}
              options={FILTERS}
              size="sm"
              aria-label="Filter tasks"
            />
          )}
          <Popover
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              align="right"
              width={200}
              aria-label={`Options for "${list.title}"`}
              trigger={
                <button
                  type="button"
                  className={styles.menuBtn}
                  aria-label={`Options for "${list.title}"`}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <Icon name="ellipsis-vertical" size="sm" aria-hidden />
                </button>
              }
            >
              <div className={styles.menu}>
                {!filterFitsInline && (
                  <>
                    <span className={styles.menuLabel}>Filter</span>
                    {FILTERS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        className={[
                          styles.menuItem,
                          filter === f.value ? styles.menuItemActive : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => {
                          setFilter(f.value);
                          setMenuOpen(false);
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                    <div className={styles.menuDivider} />
                  </>
                )}
                <span className={styles.menuLabel}>Sort by</span>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={[
                      styles.menuItem,
                      sortBy === opt.value ? styles.menuItemActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setSortBy(opt.value);
                      setMenuOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className={styles.menuDivider} />
                {completed.length > 0 && (
                  <button
                    type="button"
                    className={[styles.menuItem, styles.menuDanger].join(' ')}
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteCompletedOpen(true);
                    }}
                  >
                    Delete completed tasks
                  </button>
                )}
                <button
                  type="button"
                  className={[styles.menuItem, styles.menuDanger].join(' ')}
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  Delete list
                </button>
              </div>
          </Popover>
        </div>
        {/* Hidden measurement-only clone of the fully-inline row (dot + title
            + count + spacer + Filter + menu button), used to decide
            filterFitsInline above. position: absolute + visibility: hidden
            means it never affects real layout, and is automatically removed
            from both the tab order and the accessibility tree (unlike
            opacity: 0, which keeps an element focusable) — aria-hidden is
            added anyway for clarity of intent. Rendering the *real* CSS
            classes here (not hand-summed widths) is what lets this measure
            gaps/padding correctly without duplicating that arithmetic. */}
        <div
          ref={shadowRowRef}
          className={styles.titleRow}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            top: -9999,
            left: 0,
            width: 'max-content',
          }}
          aria-hidden
        >
          <span className={styles.dot} style={{ background: listDotColor(list.color) }} />
          <h1 className={styles.title}>{list.title}</h1>
          <span className={styles.count}>
            {active.length} {active.length === 1 ? 'task' : 'tasks'}
          </span>
          <span className={styles.spacer} />
          <SegmentedControl<Filter>
            value={filter}
            onChange={() => {}}
            options={FILTERS}
            size="sm"
            aria-label="Filter tasks"
          />
          <button type="button" className={styles.menuBtn} aria-label="Options">
            <Icon name="ellipsis-vertical" size="sm" aria-hidden />
          </button>
        </div>
      </header>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={deleteDialogRef}
        className={styles.confirmNativeDialog}
        aria-label="Delete list"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDeleteOpen(false);
        }}
      >
        <div className={styles.confirm}>
          <h2 className={styles.confirmTitle}>Delete list</h2>
          <p className={styles.confirmText}>
            Delete "{list.title}"? This permanently removes the list and all of its tasks. This
            can't be undone.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteList}>
              Delete list
            </Button>
          </div>
        </div>
      </dialog>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={deleteCompletedDialogRef}
        className={styles.confirmNativeDialog}
        aria-label="Delete completed tasks"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDeleteCompletedOpen(false);
        }}
      >
        <div className={styles.confirm}>
          <h2 className={styles.confirmTitle}>
            Delete {completed.length} completed {completed.length === 1 ? 'task' : 'tasks'}
          </h2>
          <p className={styles.confirmText}>
            This permanently removes every completed task in "{list.title}" and their subtasks.
            This can't be undone.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setDeleteCompletedOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteCompleted}>
              Delete completed tasks
            </Button>
          </div>
        </div>
      </dialog>

      <div className={styles.addRow}>
        <span className={styles.addPlus} aria-hidden>
          +
        </span>
        <input
          ref={addInputRef}
          className={styles.addInput}
          placeholder="Add a task and press Enter…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddTask();
          }}
        />
      </div>

      <DndContext
        id="tasks-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeVisible.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.taskList}>
            {activeVisible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                showCompleted={completedExpanded}
                selected={task.id === selectedTaskId}
                keyFocused={task.id === focusedId}
                bulkSelected={selectedIds.has(task.id)}
                onBulkToggle={toggleBulkSelect}
                onMutated={refresh}
                dragDisabled={sortBy !== 'manual'}
              />
            ))}
            {activeVisible.length === 0 && (
              <p className={styles.empty}>
                {filter === 'overdue'
                  ? 'Nothing overdue.'
                  : tasks.length === 0
                    ? 'No tasks yet — type above and press Enter to add one.'
                    : 'All done! Completed tasks are below.'}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {showCompletedSection && (
        <div className={styles.completed}>
          <button
            type="button"
            className={styles.completedHeader}
            aria-expanded={completedExpanded}
            onClick={toggleCompletedSection}
          >
            <span>Completed</span>
            <span className={styles.completedCount}>· {completed.length}</span>
            <span className={styles.completedChevron}>{completedExpanded ? '▴' : '▾'}</span>
          </button>
          {completedExpanded && (
            <div className={styles.taskList}>
              {completed.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  showCompleted
                  selected={task.id === selectedTaskId}
                  bulkSelected={selectedIds.has(task.id)}
                  onBulkToggle={toggleBulkSelect}
                  onMutated={refresh}
                  dragDisabled={sortBy !== 'manual'}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          lists={lists}
          currentListId={listId}
          onDelete={handleBulkDelete}
          onMove={handleBulkMove}
          onCancel={clearBulkSelect}
        />
      )}
    </div>
  );
}
