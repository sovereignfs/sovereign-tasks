'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useRef, useTransition } from 'react';
import { toggleFavorite } from '../_lib/actions';
import styles from './StarButton.module.css';

interface Props {
  taskId: string;
  listId: string;
  favorite: boolean;
  /** Called after the toggle persists; defaults to router.refresh(). */
  onMutated?: () => void;
  /**
   * Called synchronously with the new value the moment the optimistic toggle
   * fires. Needed by callers whose `favorite` prop is sourced from state
   * that isn't itself updated within this same transition — e.g. mobile's
   * MobileTasksCarousel keeps its own decoupled task caches (listState,
   * detailTask), which only refresh via a separate effect some time later.
   * Without this, `favorite` stays stale until that refetch lands, and once
   * this toggle's own transition settles React reverts the optimistic star
   * back to the (still stale) base value — a visible flip-back-then-
   * reapply flicker. Patching the caller's own state here closes that gap.
   */
  onOptimisticChange?: (next: boolean) => void;
  className?: string;
}

export default function StarButton({
  taskId,
  listId,
  favorite,
  onMutated,
  onOptimisticChange,
  className,
}: Props) {
  const router = useRouter();
  // Same optimistic pattern as TaskItem's checkbox — flip the star instantly
  // instead of waiting on the toggleFavorite round trip (+ whatever refresh
  // onMutated triggers) before showing anything.
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(
    favorite,
    (_prev: boolean, next: boolean) => next,
  );
  const [, startTransition] = useTransition();
  // Tracks the most recently *requested* value rather than reading
  // optimisticFavorite directly — a second tap landing before React has
  // re-rendered with the first tap's optimistic value would otherwise read
  // the stale pre-tap value and toggle back to it instead of continuing from
  // what was actually just requested (e.g. tap-tap in quick succession could
  // net out as a single toggle, or worse, no visible change at all).
  const pendingRef = useRef(favorite);

  function toggle(e: React.MouseEvent) {
    // Rows are clickable (open detail) — don't let the star bubble to them.
    e.preventDefault();
    e.stopPropagation();
    const next = !pendingRef.current;
    pendingRef.current = next;
    startTransition(async () => {
      setOptimisticFavorite(next);
      onOptimisticChange?.(next);
      try {
        await toggleFavorite(taskId, listId, next);
      } catch (err) {
        // The transition still settles regardless, which reverts the
        // optimistic star back to the real (unstarred) prop — correct,
        // since the write didn't actually persist. Previously this failure
        // was completely silent: the star would flip back on the next
        // refresh with no trace of why, indistinguishable from "the tap
        // just didn't register." Logging at least makes a genuine failure
        // diagnosable instead of invisible.
        console.error('Failed to toggle favorite', err);
        pendingRef.current = favorite;
        return;
      }
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
