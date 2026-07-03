'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createList, deleteList, updateList } from './_lib/actions';
import styles from './ListSidebar.module.css';

interface ListRow {
  id: string;
  title: string;
}

interface Props {
  lists: ListRow[];
}

type ListAction =
  | { type: 'add'; list: ListRow }
  | { type: 'delete'; id: string }
  | { type: 'rename'; id: string; title: string };

function listsReducer(state: ListRow[], action: ListAction): ListRow[] {
  switch (action.type) {
    case 'add':
      return [...state, action.list];
    case 'delete':
      return state.filter((l) => l.id !== action.id);
    case 'rename':
      return state.map((l) => (l.id === action.id ? { ...l, title: action.title } : l));
  }
}

export default function ListSidebar({ lists: initialLists }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  // Server props are the source of truth (re-rendered after router.refresh());
  // useOptimistic layers pending mutations on top and resets to the fresh base
  // automatically — no manual reconciliation.
  const [lists, applyListAction] = useOptimistic(initialLists, listsReducer);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [_isPending, startTransition] = useTransition();
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

  function handleCreate() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle('');
    setAdding(false);
    startTransition(async () => {
      // Optimistic placeholder shows for the pending window; createList appends
      // (sortOrder = max + 1) so the refreshed server order matches this tail.
      applyListAction({ type: 'add', list: { id: `optimistic-${Date.now()}`, title: trimmed } });
      const id = await createList(trimmed);
      router.push(`/tasks/${id}`);
      router.refresh();
    });
  }

  function startRename(e: React.MouseEvent, list: ListRow) {
    // The rename button lives inside the list <Link>; stop the click from
    // navigating to the list route.
    e.preventDefault();
    e.stopPropagation();
    setEditingId(list.id);
    setEditTitle(list.title);
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

  function handleDelete(e: React.MouseEvent, listId: string) {
    e.preventDefault();
    startTransition(async () => {
      applyListAction({ type: 'delete', id: listId });
      await deleteList(listId);
      if (pathname === `/tasks/${listId}`) {
        router.push('/tasks');
      }
      router.refresh();
    });
  }

  return (
    <nav className={styles.nav} aria-label="Task lists">
      <div className={styles.header}>
        <span className={styles.heading}>My Lists</span>
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
                        // Reset so the onBlur commit is a no-op, then exit.
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
            <li key={list.id} className={styles.item}>
              <Link
                href={`/tasks/${list.id}`}
                className={[styles.link, active ? styles.active : ''].filter(Boolean).join(' ')}
              >
                <span className={styles.listTitle}>{list.title}</span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.rowBtn}
                    aria-label={`Rename "${list.title}"`}
                    onClick={(e) => startRename(e, list)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={[styles.rowBtn, styles.deleteBtn].join(' ')}
                    aria-label={`Delete "${list.title}"`}
                    onClick={(e) => handleDelete(e, list.id)}
                  >
                    ✕
                  </button>
                </span>
              </Link>
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
