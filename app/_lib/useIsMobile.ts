'use client';

import { useIsMobile as useDsIsMobile } from '@sovereignfs/ui';

// This plugin forks its *component tree* (three-column web vs. mobile carousel)
// at 640px — narrower than the platform's canonical 768px breakpoint
// (@sovereignfs/ui's `useIsMobile` / `MOBILE_BREAKPOINT_PX`). The 641–768px band
// deliberately still shows the three-column layout, so moving to 768 would
// regress tablet users into the carousel. This threshold must also stay in
// lockstep with `layout.module.css`'s own `max-width: 640px` media query.
//
// DS-first: the matchMedia/SSR logic lives in the design system — this file is
// only the plugin's own documented breakpoint bound to that hook, not a
// reimplementation (per decision D3 in the platform's mobile design-system plan,
// a plugin may keep a narrower documented local threshold).
const TASKS_MOBILE_BREAKPOINT_PX = 640;

/** SSR-safe; delegates to `@sovereignfs/ui` with this plugin's 640px threshold. */
export function useIsMobile(): boolean {
  return useDsIsMobile(TASKS_MOBILE_BREAKPOINT_PX);
}
