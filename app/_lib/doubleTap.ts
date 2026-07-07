import { useRef } from 'react';

// Real double-clicks (desktop mouse) report e.detail === 2 natively — no
// extra work needed there. Touch-generated click events always report
// detail === 1 (no browser synthesizes a dblclick-style count from two
// taps), so double-tap has to be detected by timing two clicks against each
// other instead. Sharing one handler for both means every double-click-style
// affordance in this plugin (rename, colour picker) behaves the same way on
// mouse and touch without duplicating the two code paths per call site.
const DOUBLE_TAP_MS = 350;

// The event is passed through to onDoubleTap (rather than the hook calling
// preventDefault itself) since not every call site needs to cancel something
// — the colour dot's double-tap has no default action to cancel, while the
// title's does (stopping <Link>'s navigation).
export function useDoubleTapHandler<E extends { detail: number }>(onDoubleTap: (e: E) => void) {
  const lastTime = useRef(0);
  return (e: E) => {
    if (e.detail === 2) {
      onDoubleTap(e);
      return;
    }
    const now = Date.now();
    if (now - lastTime.current < DOUBLE_TAP_MS) {
      lastTime.current = 0;
      onDoubleTap(e);
    } else {
      lastTime.current = now;
    }
  };
}

// For call sites where the single-tap/click *does* have its own default
// action (e.g. navigating) that a following double-tap needs to be able to
// preempt. useDoubleTapHandler above is only safe when there's nothing to
// preempt — firing onSingle immediately and only detecting the double
// afterwards means a genuine double-tap's first tap already triggered the
// single action (e.g. a route change) before the second tap can cancel it.
// A real double-click gets away with this on desktop because e.detail === 2
// is the browser's own resolved signal, arriving on the same click that
// matters — but a touch double-tap has no equivalent "hold on, there might
// be a second one" signal, so the only way to know is to wait out the
// window before committing to the single action.
export function useSingleOrDoubleTap<E extends { detail: number }>(
  onSingle: (e: E) => void,
  onDouble: (e: E) => void,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (e: E) => {
    if (e.detail === 2) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      onDouble(e);
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      onDouble(e);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      onSingle(e);
    }, DOUBLE_TAP_MS);
  };
}
