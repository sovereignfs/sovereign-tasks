import {
  KeyboardSensor,
  MouseSensor as LibMouseSensor,
  TouchSensor as LibTouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  TouchEventHandler,
} from 'react';

/** Plain pointer drag (desktop, handle-initiated) — unchanged from before the
 *  touch split, kept as a named constant since it's the tuning knob. */
const MOUSE_ACTIVATION_DISTANCE_PX = 8;

/** Long-press-to-lift on touch. `delay` is how long a still hold takes before
 *  the row lifts; `tolerance` is how far the finger may drift during that
 *  hold before it's treated as a scroll/swipe instead — a finger that moves
 *  further than this within the delay window cancels activation and the
 *  native gesture (vertical scroll, carousel swipe, edge-zone reveal) wins.
 *  Tune these two if the hold feels too eager or too laggy on a real device —
 *  that's the one thing this can't be verified for in Chromium simulation. */
const TOUCH_ACTIVATION_DELAY_MS = 300;
const TOUCH_ACTIVATION_TOLERANCE_PX = 8;

/**
 * True when a drag should be allowed to start from `target`. Refused when
 * `target` sits inside an element marked `data-no-dnd` — swipe edge zones,
 * the checkbox/star/subtask-ring, list rename inputs, and the list ⋯ button
 * all opt out so a long-press there performs its own action (or, for the
 * touch-only controls, simply does nothing) instead of lifting the row.
 * Exported standalone so it's unit-testable without spinning up dnd-kit.
 */
export function shouldHandleDndEvent(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return target.closest('[data-no-dnd]') === null;
}

// dnd-kit's documented pattern for scoping sensor activation to specific
// elements: subclass the built-in sensor and replace its static `activators`
// with a handler that inspects the originating event's target before
// deferring to the base activation logic (distance/delay/tolerance), which
// dnd-kit re-checks internally regardless of what this returns.
class MouseSensor extends LibMouseSensor {
  static override activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent: event }: ReactMouseEvent) => shouldHandleDndEvent(event.target),
    },
  ];
}

class TouchSensor extends LibTouchSensor {
  static override activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent: event }: ReactTouchEvent) => shouldHandleDndEvent(event.target),
    },
  ];
}

/**
 * Extracts just the touch activator from `useSortable`'s `listeners`, typed
 * for a plain `<div onTouchStart>` — for spreading onto a row container so a
 * long-press anywhere on it (not just the handle) can lift it, without also
 * forwarding `onMouseDown` (which would let a mouse-drag start from the row
 * on a narrow desktop window — see the two call sites for the full
 * reasoning). Returns undefined when `enabled` is false or there's nothing
 * to forward, so callers can spread it unconditionally.
 */
export function touchOnlyListeners(
  listeners: SyntheticListenerMap | undefined,
  enabled: boolean,
): { onTouchStart: TouchEventHandler<HTMLElement> } | undefined {
  const onTouchStart = listeners?.onTouchStart;
  if (!enabled || !onTouchStart) return undefined;
  return { onTouchStart: onTouchStart as TouchEventHandler<HTMLElement> };
}

/**
 * Shared sensor set for both reorderable lists in this plugin (task rows,
 * list rows) — MouseSensor for desktop's handle-initiated drag, TouchSensor
 * for mobile's long-press lift, KeyboardSensor unchanged. See
 * `docs/ux-improvement-plan.md` Task 1 for the full design.
 */
export function useReorderSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_ACTIVATION_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_ACTIVATION_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
