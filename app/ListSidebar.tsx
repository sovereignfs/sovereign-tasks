'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createList, deleteList } from '../lib/actions';
import styles from './ListSidebar.module.css';

interface ListRow {
  id: string;
  title: string;
}

interface Props {
  lists: ListRow[];
}

export default function ListSidebar({ lists: initialLists }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [_isPending, startTransition] = useTransition();
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  async function handleCreate() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const id = await createList(trimmed);
    setNewTitle('');
    setAdding(false);
    startTransition(() => {
      router.push(`/tasks/${id}`);
      router.refresh();
    });
  }

  async function handleDelete(e: React.MouseEvent, listId: string) {
    e.preventDefault();
    await deleteList(listId);
    setLists((prev) => prev.filter((l) => l.id !== listId));
    if (pathname === `/tasks/${listId}`) {
      router.push('/tasks');
    }
    router.refresh();
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
          return (
            <li key={list.id} className={styles.item}>
              <Link
                href={`/tasks/${list.id}`}
                className={[styles.link, active ? styles.active : ''].filter(Boolean).join(' ')}
              >
                <span className={styles.listTitle}>{list.title}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={`Delete "${list.title}"`}
                  onClick={(e) => handleDelete(e, list.id)}
                >
                  ✕
                </button>
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
