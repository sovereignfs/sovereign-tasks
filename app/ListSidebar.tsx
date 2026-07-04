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
import { Button, Icon, Popover, Tooltip } from '@sovereignfs/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createList, deleteList, reorderLists, updateList, updateListColor } from './_lib/actions';
import { LIST_SWATCHES, listDotColor } from './_lib/colors';
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
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
    setMenuOpenId(null);
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                menuOpen={menuOpenId === list.id}
                onEditTitleChange={setEditTitle}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={(l) => {
                  setEditTitle(l.title);
                  setEditingId(null);
                }}
                onMenuToggle={() => setMenuOpenId((id) => (id === list.id ? null : list.id))}
                onMenuClose={() => setMenuOpenId(null)}
                onStartRename={(l) => {
                  setMenuOpenId(null);
                  setEditingId(l.id);
                  setEditTitle(l.title);
                }}
                onColor={handleColor}
                onRequestDelete={(l) => {
                  setMenuOpenId(null);
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
  menuOpen: boolean;
  onEditTitleChange: (value: string) => void;
  onRenameCommit: (list: ListRow) => void;
  onRenameCancel: (list: ListRow) => void;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onStartRename: (list: ListRow) => void;
  onColor: (list: ListRow, color: string) => void;
  onRequestDelete: (list: ListRow) => void;
}

function ListItem({
  list,
  active,
  editing,
  editTitle,
  renameInputRef,
  menuOpen,
  onEditTitleChange,
  onRenameCommit,
  onRenameCancel,
  onMenuToggle,
  onMenuClose,
  onStartRename,
  onColor,
  onRequestDelete,
}: ListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (editing) {
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
      className={[
        styles.item,
        active ? styles.active : '',
        isDragging ? styles.dragging : '',
        menuOpen ? styles.menuOpenRow : '',
      ]
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
      <div className={styles.rowInner}>
        <Link href={`/tasks/${list.id}`} className={styles.link}>
          <span className={styles.dot} style={{ background: listDotColor(list.color) }} aria-hidden />
          <span className={styles.listTitle}>{list.title}</span>
        </Link>
        <span className={styles.trail}>
          {list.openCount > 0 && <span className={styles.count}>{list.openCount}</span>}
          <Popover
            open={menuOpen}
            onClose={onMenuClose}
            align="right"
            width={180}
            aria-label={`Actions for "${list.title}"`}
            trigger={
              <button
                type="button"
                className={styles.menuBtn}
                aria-label={`Actions for "${list.title}"`}
                onClick={onMenuToggle}
              >
                ⋯
              </button>
            }
          >
            <div className={styles.menu}>
              <div className={styles.swatches}>
                {LIST_SWATCHES.map((s) => (
                  <Tooltip key={s.key} content={s.label} side="bottom">
                    <button
                      type="button"
                      className={[styles.swatch, list.color === s.key ? styles.swatchActive : '']
                        .filter(Boolean)
                        .join(' ')}
                      style={{ background: s.token }}
                      aria-label={`Set colour ${s.label}`}
                      onClick={() => onColor(list, s.key)}
                    />
                  </Tooltip>
                ))}
              </div>
              <button type="button" className={styles.menuItem} onClick={() => onStartRename(list)}>
                Rename
              </button>
              <button
                type="button"
                className={[styles.menuItem, styles.menuDanger].join(' ')}
                onClick={() => onRequestDelete(list)}
              >
                Delete
              </button>
            </div>
          </Popover>
        </span>
      </div>
    </li>
  );
}

/** Matches @sovereignfs/ui's DragHandleRow icon, reproduced locally since this
 *  row uses an absolutely-positioned handle (no reserved gutter) rather than
 *  DragHandleRow's flex layout — see the sidebar row-layout brainstorm. */
function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {[3, 7, 11].map((cy) =>
        [4, 10].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} fill="currentColor" />),
      )}
    </svg>
  );
}
