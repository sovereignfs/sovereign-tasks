'use client';

import { Popover } from '@sovereignfs/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createList, deleteList, updateList, updateListColor } from './_lib/actions';
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
  | { type: 'color'; id: string; color: string | null };

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
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();
  const addInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingId]);

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

  function handleColor(list: ListRow, color: string | null) {
    setMenuOpenId(null);
    startTransition(async () => {
      applyListAction({ type: 'color', id: list.id, color });
      await updateListColor(list.id, color);
      router.refresh();
    });
  }

  function handleDelete(list: ListRow) {
    setMenuOpenId(null);
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
          +
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

      <ul className={styles.list}>
        {lists.map((list) => {
          const active = pathname === `/tasks/${list.id}`;

          if (editingId === list.id) {
            return (
              <li key={list.id} className={styles.item}>
                <div className={styles.editRow}>
                  <input
                    ref={renameInputRef}
                    className={styles.renameInput}
                    value={editTitle}
                    aria-label={`Rename "${list.title}"`}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRenameCommit(list)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCommit(list);
                      if (e.key === 'Escape') {
                        setEditTitle(list.title);
                        setEditingId(null);
                      }
                    }}
                  />
                </div>
              </li>
            );
          }

          return (
            <li key={list.id} className={[styles.item, active ? styles.active : ''].filter(Boolean).join(' ')}>
              <Link href={`/tasks/${list.id}`} className={styles.link}>
                <span
                  className={styles.dot}
                  style={{ background: listDotColor(list.color) }}
                  aria-hidden
                />
                <span className={styles.listTitle}>{list.title}</span>
              </Link>
              <span className={styles.trail}>
                {list.openCount > 0 && <span className={styles.count}>{list.openCount}</span>}
                <Popover
                  open={menuOpenId === list.id}
                  onClose={() => setMenuOpenId(null)}
                  align="right"
                  width={180}
                  aria-label={`Actions for "${list.title}"`}
                  trigger={
                    <button
                      type="button"
                      className={styles.menuBtn}
                      aria-label={`Actions for "${list.title}"`}
                      onClick={() => setMenuOpenId((id) => (id === list.id ? null : list.id))}
                    >
                      ⋯
                    </button>
                  }
                >
                  <div className={styles.menu}>
                    <div className={styles.swatches}>
                      {LIST_SWATCHES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          className={[styles.swatch, list.color === s.key ? styles.swatchActive : '']
                            .filter(Boolean)
                            .join(' ')}
                          style={{ background: s.token }}
                          aria-label={`Set colour ${s.label}`}
                          onClick={() => handleColor(list, s.key)}
                        />
                      ))}
                      <button
                        type="button"
                        className={styles.swatchClear}
                        aria-label="No colour"
                        onClick={() => handleColor(list, null)}
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        setMenuOpenId(null);
                        setEditingId(list.id);
                        setEditTitle(list.title);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className={[styles.menuItem, styles.menuDanger].join(' ')}
                      onClick={() => handleDelete(list)}
                    >
                      Delete
                    </button>
                  </div>
                </Popover>
              </span>
            </li>
          );
        })}
      </ul>

      {lists.length === 0 && !adding && (
        <p className={styles.empty}>No lists yet. Create one above.</p>
      )}
    </nav>
  );
}
