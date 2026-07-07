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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Drawer, Icon, Popover, Tooltip } from '@sovereignfs/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createList, deleteList, reorderLists, updateList, updateListColor } from './_lib/actions';
import GripIcon from './_components/GripIcon';
import { LIST_SWATCHES, listDotColor } from './_lib/colors';
import { useDoubleTapHandler, useSingleOrDoubleTap } from './_lib/doubleTap';
import { useIsMobile } from './_lib/useIsMobile';
import type { ListRow } from './_lib/types';
import styles from './ListSidebar.module.css';

interface Props {
  lists: ListRow[];
}

type ListAction =
  | { type: 'add'; list: ListRow }
  | { type: 'delete'; id: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'color'; id: string; color: string }
  | { type: 'reorder'; ids: string[] };

function listsReducer(state: ListRow[], action: ListAction): ListRow[] {
  switch (action.type) {
    case 'add':
      return [...state, action.list];
    case 'delete':
      return state.filter((l) => l.id !== action.id);
    case 'rename':
      return state.map((l) => (l.id === action.id ? { ...l, title: action.title } : l));
    case 'color':
      return state.map((l) => (l.id === action.id ? { ...l, color: action.color } : l));
    case 'reorder': {
      const byId = new Map(state.map((l) => [l.id, l]));
      return action.ids.map((id) => byId.get(id)).filter((l): l is ListRow => l !== undefined);
    }
  }
}

export default function ListSidebar({ lists: initialLists }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [lists, applyListAction] = useOptimistic(initialLists, listsReducer);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  // The small colour-swatch popover triggered by double-clicking/double-
  // tapping a list's dot — same interaction and same Popover on both desktop
  // and mobile now (see ListItem).
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);
  // Mobile only — which row (if any) currently has its swipe-to-delete action
  // revealed. A single id (not a Set) means opening one row's reveal via a
  // prop-driven re-render automatically slides any previously-open row shut,
  // with no extra "close the others" plumbing needed — see ListItem.
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingId]);

  // Native <dialog> for the delete confirmation — sized to content, unlike
  // @sovereignfs/ui's Dialog (a fixed-size box by design for tabbed/multi-view
  // content), which left a large dead area below a short confirm message.
  // Mirrors plugins/account's RevokeSessionButton pattern.
  useEffect(() => {
    const el = deleteDialogRef.current;
    if (!el) return;
    if (deleteTarget) el.showModal();
    else el.close();
  }, [deleteTarget]);

  useEffect(() => {
    const el = deleteDialogRef.current;
    if (!el) return;
    const handleClose = () => setDeleteTarget(null);
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/tasks/search?q=${encodeURIComponent(q)}`);
  }

  function handleCreate() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle('');
    setAdding(false);
    startTransition(async () => {
      applyListAction({
        type: 'add',
        list: { id: `optimistic-${Date.now()}`, title: trimmed, color: null, openCount: 0 },
      });
      const id = await createList(trimmed);
      router.push(`/tasks/${id}`);
      router.refresh();
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // A pointer-driven drag leaves the handle <button> focused (native
    // pointerdown-focuses-button behavior); dnd-kit never blurs it after
    // drop, so :focus-within keeps the grip/menu revealed on the dragged row
    // even once the mouse has moved elsewhere — alongside whatever row is
    // now genuinely hovered. Release it so only real hover governs
    // visibility. Keyboard-driven reorders intentionally keep focus on the
    // handle so arrow-key navigation can continue, so this only fires for
    // pointer input.
    if (event.activatorEvent instanceof PointerEvent) {
      (document.activeElement as HTMLElement | null)?.blur();
    }

    if (!over || active.id === over.id) return;
    const oldIndex = lists.findIndex((l) => l.id === active.id);
    const newIndex = lists.findIndex((l) => l.id === over.id);
    const ids = arrayMove(lists, oldIndex, newIndex).map((l) => l.id);
    startTransition(async () => {
      applyListAction({ type: 'reorder', ids });
      await reorderLists(ids);
      router.refresh();
    });
  }

  function handleRenameCommit(list: ListRow) {
    const trimmed = editTitle.trim();
    setEditingId(null);
    if (trimmed && trimmed !== list.title) {
      startTransition(async () => {
        applyListAction({ type: 'rename', id: list.id, title: trimmed });
        await updateList(list.id, trimmed);
        router.refresh();
      });
    }
  }

  function handleColor(list: ListRow, color: string) {
    startTransition(async () => {
      applyListAction({ type: 'color', id: list.id, color });
      await updateListColor(list.id, color);
      router.refresh();
    });
  }

  function confirmDelete() {
    const list = deleteTarget;
    setDeleteTarget(null);
    if (!list) return;
    startTransition(async () => {
      applyListAction({ type: 'delete', id: list.id });
      await deleteList(list.id);
      if (pathname === `/tasks/${list.id}`) router.push('/tasks');
      router.refresh();
    });
  }

  return (
    <nav className={styles.nav} aria-label="Task lists">
      <form className={styles.searchRow} onSubmit={submitSearch} role="search">
        <span className={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tasks"
        />
      </form>

      <div className={styles.header}>
        <span className={styles.heading}>My lists</span>
        <button
          type="button"
          className={styles.newBtn}
          aria-label="New list"
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size="sm" aria-hidden />
        </button>
      </div>

      {adding && (
        <div className={styles.addRow}>
          <input
            ref={addInputRef}
            className={styles.addInput}
            placeholder="List name"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setNewTitle('');
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!newTitle.trim()) setAdding(false);
            }}
          />
        </div>
      )}

      <DndContext
        id="lists-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {lists.map((list) => (
              <ListItem
                key={list.id}
                list={list}
                active={pathname === `/tasks/${list.id}`}
                editing={editingId === list.id}
                editTitle={editTitle}
                renameInputRef={renameInputRef}
                colorPickerOpen={colorPickerOpenId === list.id}
                swipeOpen={swipeOpenId === list.id}
                onEditTitleChange={setEditTitle}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={(l) => {
                  setEditTitle(l.title);
                  setEditingId(null);
                }}
                onColorPickerToggle={() =>
                  setColorPickerOpenId((id) => (id === list.id ? null : list.id))
                }
                onColorPickerClose={() => setColorPickerOpenId(null)}
                onSwipeOpen={() => setSwipeOpenId(list.id)}
                onSwipeClose={() => setSwipeOpenId(null)}
                onStartRename={(l) => {
                  setEditingId(l.id);
                  setEditTitle(l.title);
                }}
                onColor={handleColor}
                onRequestDelete={(l) => {
                  setSwipeOpenId(null);
                  setDeleteTarget(l);
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {lists.length === 0 && !adding && (
        <p className={styles.empty}>No lists yet. Create one above.</p>
      )}

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={deleteDialogRef}
        className={styles.confirmNativeDialog}
        aria-label="Delete list"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDeleteTarget(null);
        }}
      >
        <div className={styles.confirm}>
          <h2 className={styles.confirmTitle}>Delete list</h2>
          <p className={styles.confirmText}>
            Delete “{deleteTarget?.title}”? This permanently removes the list and all of its tasks.
            This can’t be undone.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete list
            </Button>
          </div>
        </div>
      </dialog>
    </nav>
  );
}

interface ListItemProps {
  list: ListRow;
  active: boolean;
  editing: boolean;
  editTitle: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  colorPickerOpen: boolean;
  swipeOpen: boolean;
  onEditTitleChange: (value: string) => void;
  onRenameCommit: (list: ListRow) => void;
  onRenameCancel: (list: ListRow) => void;
  onColorPickerToggle: () => void;
  onColorPickerClose: () => void;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onStartRename: (list: ListRow) => void;
  onColor: (list: ListRow, color: string) => void;
  onRequestDelete: (list: ListRow) => void;
}

// Mobile-only swipe-to-delete reveal width (px) — must match .swipeDeleteBtn's
// own width in ListSidebar.module.css; kept as one constant here since the
// drag math (clamping, open/close threshold) needs the same number.
const SWIPE_REVEAL_WIDTH = 72;

// Shared by desktop's standalone colour popover and mobile's combined
// rename+colour drawer — same swatch grid, just a different `onPicked` (the
// popover closes itself after a pick; the drawer stays open so rename and
// colour can both be adjusted before Cancel/Save) and `showLabels`.
//
// showLabels is mobile-only: Tooltip only shows on hover, which touch has no
// equivalent of, so a touch user had no way to see which colour was which
// beyond guessing from the swatch itself. showLabels swaps the hover tooltip
// for an always-visible caption under each swatch and enlarges the swatch
// itself (was 18px, sized for desktop's compact popover — too small a touch
// target on a full-width mobile sheet with room to spare). The selected
// swatch also gets a checkmark on top of the existing ring in both modes —
// the ring alone was easy to miss.
function ColorSwatches({
  list,
  onColor,
  onPicked,
  showLabels = false,
}: {
  list: ListRow;
  onColor: (list: ListRow, color: string) => void;
  onPicked?: () => void;
  showLabels?: boolean;
}) {
  return (
    <div
      className={[styles.swatches, showLabels ? styles.swatchesLabeled : '']
        .filter(Boolean)
        .join(' ')}
    >
      {LIST_SWATCHES.map((s) => {
        const isActive = list.color === s.key;
        const swatchButton = (
          <button
            type="button"
            className={[
              styles.swatch,
              showLabels ? styles.swatchLarge : '',
              isActive ? styles.swatchActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ background: s.token }}
            aria-label={`Set colour ${s.label}`}
            aria-pressed={isActive}
            onClick={() => {
              onColor(list, s.key);
              onPicked?.();
            }}
          >
            {isActive && (
              <Icon
                name="check"
                size={showLabels ? 'sm' : 'xs'}
                className={styles.swatchCheck}
                aria-hidden
              />
            )}
          </button>
        );
        return showLabels ? (
          <div key={s.key} className={styles.swatchCell}>
            {swatchButton}
            <span className={styles.swatchName}>{s.label}</span>
          </div>
        ) : (
          <Tooltip key={s.key} content={s.label} side="bottom">
            {swatchButton}
          </Tooltip>
        );
      })}
    </div>
  );
}

function ListItem({
  list,
  active,
  editing,
  editTitle,
  renameInputRef,
  colorPickerOpen,
  swipeOpen,
  onEditTitleChange,
  onRenameCommit,
  onRenameCancel,
  onColorPickerToggle,
  onColorPickerClose,
  onSwipeOpen,
  onSwipeClose,
  onStartRename,
  onColor,
  onRequestDelete,
}: ListItemProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // Desktop: e.detail === 2 is the browser's own resolved double-click
  // signal, arriving on the very click that matters — rename can fire (and
  // cancel <Link>'s navigation) immediately, with nothing to preempt.
  function handleDesktopTitleClick(e: React.MouseEvent) {
    if (e.detail === 2) {
      e.preventDefault();
      onStartRename(list);
    }
  }
  // Mobile has no equivalent signal: a touch double-tap's first tap can't
  // tell whether a second one is coming. Firing navigation immediately on
  // that first tap (the way <Link> normally would) meant a genuine
  // double-tap briefly navigated the whole carousel over to this list's
  // Tasks slide before the second tap reopened the rename+colour drawer —
  // useSingleOrDoubleTap defers the single-tap navigation instead, so it
  // only actually happens once the double-tap window has closed with no
  // second tap.
  const handleMobileTitleTap = useSingleOrDoubleTap<React.MouseEvent>(
    () => router.push(`/tasks/${list.id}`),
    () => onStartRename(list),
  );
  const handleDotDoubleTap = useDoubleTapHandler(() => onColorPickerToggle());

  // Mobile-only swipe-to-delete. Tracks the gesture in a ref (not state) so
  // dragging updates the DOM directly at 60fps instead of re-rendering on
  // every pointermove; only the final open/closed outcome (on release)
  // becomes real state (swipeOpen, lifted to ListSidebar), which then drives
  // the declarative transform + CSS transition for the snap animation.
  const rowInnerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    locked: 'horizontal' | 'vertical' | null;
  } | null>(null);

  function handleRowPointerDown(e: React.PointerEvent) {
    if (!isMobile) return;
    // Pointer capture keeps move/up events targeting this element even once
    // the drag has moved well outside its narrow bounds (the whole point of
    // starting from a thin edge strip) — without it, later pointermove events
    // go to whatever the finger is now physically over instead of here.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, locked: null };
  }

  function handleRowPointerMove(e: React.PointerEvent) {
    const state = dragState.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.locked) {
      // Wait for a clear, deliberate movement before committing to a
      // direction — a few px of jitter on a tap shouldn't lock anything.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.locked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    // Vertical drags fall through untouched — this is what lets the page's
    // own vertical scroll keep working; only a horizontal drag is ours to
    // handle (touch-action: pan-y on .rowInner tells the browser the same
    // thing, so its native scroll doesn't fight this over a horizontal
    // gesture, including the outer carousel's own horizontal swipe).
    if (state.locked !== 'horizontal') return;
    e.preventDefault();
    const base = swipeOpen ? -SWIPE_REVEAL_WIDTH : 0;
    const next = Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, base + dx));
    if (rowInnerRef.current) rowInnerRef.current.style.transform = `translateX(${next}px)`;
  }

  function handleRowPointerUp(e: React.PointerEvent) {
    const state = dragState.current;
    dragState.current = null;
    if (!state || state.locked !== 'horizontal') return;
    const dx = e.clientX - state.startX;
    const base = swipeOpen ? -SWIPE_REVEAL_WIDTH : 0;
    const finalX = Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, base + dx));
    // Clear the manually-driven inline style so the declarative style prop
    // below (based on the swipeOpen state this sets) takes over — the CSS
    // transition on .rowInner then animates from wherever this drag left off
    // to the resolved open/closed position.
    if (rowInnerRef.current) rowInnerRef.current.style.transform = '';
    if (finalX < -SWIPE_REVEAL_WIDTH / 2) onSwipeOpen();
    else onSwipeClose();
  }

  // While a row's delete action is revealed, any tap on its content (title,
  // dot) closes it instead of performing that element's normal action —
  // otherwise the very next tap needed to dismiss the reveal would instead
  // navigate or open the colour picker.
  function closeSwipeOrElse(e: { preventDefault: () => void }, action: () => void) {
    if (swipeOpen) {
      e.preventDefault();
      onSwipeClose();
      return;
    }
    action();
  }

  // Desktop keeps the inline-edit-swap row exactly as before; on mobile,
  // renaming happens in its own Drawer (below) instead, so the row itself is
  // never replaced — matching the mockups' dedicated rename screen.
  if (editing && !isMobile) {
    return (
      <li ref={setNodeRef} style={style} className={styles.item}>
        <div className={styles.editRow}>
          <input
            ref={renameInputRef}
            className={styles.renameInput}
            value={editTitle}
            aria-label={`Rename "${list.title}"`}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onBlur={() => onRenameCommit(list)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameCommit(list);
              if (e.key === 'Escape') onRenameCancel(list);
            }}
          />
        </div>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[styles.item, active ? styles.active : '', isDragging ? styles.dragging : '']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {/* Mobile-only swipe-to-delete reveal, sitting behind .rowInner (see
          its own z-index/position in the CSS) — .rowInner has an opaque,
          inherited background so this stays hidden until dragged into view. */}
      <div className={styles.swipeDeleteBg} aria-hidden={!swipeOpen}>
        <button
          type="button"
          className={styles.swipeDeleteBtn}
          aria-label={`Delete "${list.title}"`}
          onClick={() => {
            onSwipeClose();
            onRequestDelete(list);
          }}
        >
          Delete
        </button>
      </div>
      <div
        ref={rowInnerRef}
        className={styles.rowInner}
        style={{ transform: swipeOpen ? `translateX(-${SWIPE_REVEAL_WIDTH}px)` : undefined }}
      >
        {isMobile ? (
          // Mobile: the dot is a plain indicator, not its own interactive
          // trigger — colour lives inside the combined rename+colour drawer
          // reached via the title below, per the single-drawer redesign.
          <span
            className={styles.dot}
            style={{ background: listDotColor(list.color) }}
            aria-hidden
          />
        ) : (
          <Popover
            open={colorPickerOpen}
            onClose={onColorPickerClose}
            // 'left' — Popover's .left aligns the panel's *left* edge to the
            // trigger's left edge, expanding rightward into the sidebar.
            // 'right' would align the panel's right edge to this ~8px-wide
            // trigger sitting near the sidebar's left edge, pushing a 180px
            // panel almost entirely off-screen to the left.
            align="left"
            // 6 swatches (18px) + 5 gaps (--sv-space-2, 8px) + padding
            // (--sv-space-3, 12px each side) = 172px — 180 leaves a touch of
            // breathing room. See .swatches for the matching gap.
            width={180}
            // Square corners for this compact swatch grid — the default
            // rounded panel chrome (packages/ui's Popover) reads oddly at
            // this size; every other Popover in this plugin keeps it.
            panelStyle={{ borderRadius: 0 }}
            aria-label={`Change colour for "${list.title}"`}
            trigger={
              <button
                type="button"
                className={styles.dotButton}
                style={{ background: listDotColor(list.color) }}
                aria-label={`Change colour for "${list.title}"`}
                onClick={(e) => closeSwipeOrElse(e, () => handleDotDoubleTap(e))}
              />
            }
          >
            <ColorSwatches list={list} onColor={onColor} onPicked={onColorPickerClose} />
          </Popover>
        )}
        <Link
          href={`/tasks/${list.id}`}
          className={styles.link}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            closeSwipeOrElse(e, () => {
              if (isMobile) {
                e.preventDefault();
                handleMobileTitleTap(e);
              } else {
                handleDesktopTitleClick(e);
              }
            });
          }}
        >
          <span className={styles.listTitle}>{list.title}</span>
        </Link>
        <span className={styles.trail}>
          {list.openCount > 0 && <span className={styles.count}>{list.openCount}</span>}
        </span>
        {isMobile && (
          // The only region a swipe-to-delete drag can start from — see
          // .swipeEdgeZone in ListSidebar.module.css for why this is a
          // separate element rather than handlers on the whole row.
          <div
            className={styles.swipeEdgeZone}
            aria-hidden
            onPointerDown={handleRowPointerDown}
            onPointerMove={handleRowPointerMove}
            onPointerUp={handleRowPointerUp}
            onPointerCancel={handleRowPointerUp}
          />
        )}
      </div>

      {isMobile && (
        <Drawer open={editing} onClose={() => onRenameCancel(list)} aria-label={`Edit "${list.title}"`}>
          <div className={styles.renameSheet}>
            <div className={styles.renameSheetHeader}>
              <button
                type="button"
                className={styles.renameSheetCancel}
                onClick={() => onRenameCancel(list)}
              >
                Cancel
              </button>
              <span className={styles.renameSheetTitle}>Edit list</span>
              <button
                type="button"
                className={styles.renameSheetSave}
                onClick={() => onRenameCommit(list)}
              >
                Save
              </button>
            </div>
            <label className={styles.renameSheetLabel} htmlFor={`rename-${list.id}`}>
              List name
            </label>
            <input
              id={`rename-${list.id}`}
              ref={renameInputRef}
              className={styles.renameSheetInput}
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameCommit(list);
                if (e.key === 'Escape') onRenameCancel(list);
              }}
            />
            <span className={styles.renameSheetLabel}>Colour</span>
            <ColorSwatches list={list} onColor={onColor} showLabels />
          </div>
        </Drawer>
      )}
    </li>
  );
}
