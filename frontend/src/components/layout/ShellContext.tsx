import { createContext, useContext, useEffect, type RefObject } from 'react';

export interface ShellContextValue {
  /** The mobile top bar shows a back button for this route (so in-page breadcrumbs are redundant on phones). */
  hasMobileBack: boolean;
  /** The bottom tab bar is visible on small screens for this route. */
  hasTabBar: boolean;
  /** <ActionBar> reports its height (0 when unmounted) so the page reserves room for it. */
  setActionBarHeight: (height: number) => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

/** `null` outside the signed-in app shell (public pages, onboarding). */
export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}

/** Keep the shell told how tall a pinned action bar is, so page content never hides behind it. */
export function useReportActionBarHeight(ref: RefObject<HTMLElement>) {
  const shell = useShell();
  const setHeight = shell?.setActionBarHeight;
  useEffect(() => {
    const el = ref.current;
    if (!el || !setHeight) return;
    const update = () => setHeight(getComputedStyle(el).position === 'fixed' ? el.offsetHeight : 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      setHeight(0);
    };
  }, [ref, setHeight]);
}
