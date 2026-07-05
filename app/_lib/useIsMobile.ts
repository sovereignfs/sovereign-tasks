'use client';

import { useEffect, useState } from 'react';

// Matches layout.module.css's own "stack" breakpoint — this plugin's existing
// definition of "phone-sized". Kept as the single source for the JS-side
// behavioral fork (which component tree mounts) that CSS media queries alone
// can't express.
const MOBILE_QUERY = '(max-width: 640px)';

/** SSR-safe: defaults to false (desktop) until the client mounts and reads
 *  the real viewport, avoiding a hydration mismatch. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    function handleChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
