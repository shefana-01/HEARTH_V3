import { useCallback, useSyncExternalStore } from 'react';

/** Tailwind's default breakpoints, so JS and CSS agree on what "desktop" means. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

/** Subscribe to a CSS media query. Returns `false` where `matchMedia` is unavailable. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** True at or above a Tailwind breakpoint (e.g. `useMinWidth('lg')`). */
export const useMinWidth = (bp: keyof typeof BREAKPOINTS) => useMediaQuery(`(min-width: ${BREAKPOINTS[bp]}px)`);
