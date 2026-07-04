'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toggleFavorite } from '../_lib/actions';
import styles from './StarButton.module.css';

interface Props {
  taskId: string;
  listId: string;
  favorite: boolean;
  /** Called after the toggle persists; defaults to router.refresh(). */
  onMutated?: () => void;
}

export default function StarButton({ taskId, listId, favorite, onMutated }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // Rows are clickable (open detail) — don't let the star bubble to them.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await toggleFavorite(taskId, listId, !favorite);
      if (onMutated) onMutated();
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={[styles.star, favorite ? styles.on : ''].filter(Boolean).join(' ')}
      aria-pressed={favorite}
      aria-label={favorite ? 'Unstar task' : 'Star task'}
      onClick={toggle}
    >
      {favorite ? '★' : '☆'}
    </button>
  );
}
