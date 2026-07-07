'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { toggleFavorite } from '../_lib/actions';
import styles from './StarButton.module.css';

interface Props {
  taskId: string;
  listId: string;
  favorite: boolean;
  /** Called after the toggle persists; defaults to router.refresh(). */
  onMutated?: () => void;
  className?: string;
}

export default function StarButton({ taskId, listId, favorite, onMutated, className }: Props) {
  const router = useRouter();
  // Same optimistic pattern as TaskItem's checkbox — flip the star instantly
  // instead of waiting on the toggleFavorite round trip (+ whatever refresh
  // onMutated triggers) before showing anything.
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(
    favorite,
    (_prev: boolean, next: boolean) => next,
  );
  const [, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // Rows are clickable (open detail) — don't let the star bubble to them.
    e.preventDefault();
    e.stopPropagation();
    const next = !optimisticFavorite;
    startTransition(async () => {
      setOptimisticFavorite(next);
      await toggleFavorite(taskId, listId, next);
      if (onMutated) onMutated();
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={[styles.star, optimisticFavorite ? styles.on : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      aria-pressed={optimisticFavorite}
      aria-label={optimisticFavorite ? 'Unstar task' : 'Star task'}
      onClick={toggle}
    >
      {optimisticFavorite ? '★' : '☆'}
    </button>
  );
}
