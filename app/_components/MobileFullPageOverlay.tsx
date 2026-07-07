'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './MobileFullPageOverlay.module.css';

export interface MobileFullPageOverlayProps {
  /** Whether the overlay is shown. Stays mounted through the close transition
   *  (see the phase state below), then unmounts. */
  open: boolean;
  /** Called on Esc. There's no scrim/backdrop to tap — closing is via an
   *  explicit close control the content supplies itself (unlike Drawer, this
   *  replaces the whole content slot the way a slide would, so there's no
   *  "outside" to tap). */
  onClose: () => void;
  /** Accessible name for the panel (sets `aria-label`). */
  'aria-label'?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const TRANSITION_MS = 250;

type Phase = 'closed' | 'entering' | 'open' | 'closing';

/**
 * MobileFullPageOverlay — a mobile-only, full-page replacement for a slide's
 * content (fills the same rect as ListSidebar/TasksPane, between the shell's
 * sticky header and MobileNav footer), used for task detail and list-edit on
 * mobile instead of Drawer's partial-height bottom sheet. Unlike Drawer,
 * there's no scrim and no built-in header/close button — the content decides
 * its own header and close control (TaskDetailPane already has one; the list
 * edit sheet adds one), this component only owns positioning, the slide-up
 * transition, focus trap, and Esc-to-close.
 */
export default function MobileFullPageOverlay({
  open,
  onClose,
  'aria-label': ariaLabel,
  children,
}: MobileFullPageOverlayProps) {
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Two-step open (mount closed → next frame flip to open) so the transform
  // change is a genuine committed-style transition, not a same-frame no-op;
  // two-step close (closing → unmount after the transition) so the slide-down
  // actually plays instead of the panel just vanishing.
  useEffect(() => {
    if (open) {
      setPhase('entering');
      const raf = requestAnimationFrame(() => setPhase('open'));
      return () => cancelAnimationFrame(raf);
    }
    setPhase((p) => (p === 'closed' ? 'closed' : 'closing'));
    const t = setTimeout(() => setPhase('closed'), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [open]);

  const mounted = phase !== 'closed';

  useEffect(() => {
    if (!mounted) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => previouslyFocused.current?.focus();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={[styles.panel, phase === 'open' ? styles.panelOpen : ''].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
