import { useEffect, useRef } from 'react';
import { LIVE_EVENT, type LiveScope } from '@/services/live/liveUpdates';

/**
 * Calls `reload` when another family member changes one of `scopes`. Bursts of changes (a handover touches
 * tasks, plan and chat at once) become one reload, after a short pause.
 */
export function useLiveRefresh(scopes: LiveScope[], reload: () => unknown, delayMs = 800): void {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const key = scopes.join(',');

  useEffect(() => {
    const wanted = new Set(key.split(','));
    let timer: number | undefined;
    const handler = (e: Event) => {
      const changed = (e as CustomEvent<LiveScope[]>).detail;
      if (!changed.some((s) => wanted.has(s))) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Don't refetch for a tab nobody is looking at; it refreshes when it becomes visible.
        if (document.visibilityState === 'visible') void reloadRef.current();
        else pending = true;
      }, delayMs);
    };
    let pending = false;
    const onVisible = () => {
      if (pending && document.visibilityState === 'visible') {
        pending = false;
        void reloadRef.current();
      }
    };
    window.addEventListener(LIVE_EVENT, handler);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIVE_EVENT, handler);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, delayMs]);
}
