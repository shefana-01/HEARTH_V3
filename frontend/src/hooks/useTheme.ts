import { useCallback, useSyncExternalStore } from 'react';
import { getDisplayPrefs, resolveTheme, saveDisplayPrefs, subscribeDisplayPrefs, type ResolvedTheme, type ThemePreference } from '@/lib/prefs';

/** The colour theme: what the person chose, what is actually showing, and a way to change it. */
export function useTheme(): { preference: ThemePreference; resolved: ResolvedTheme; setPreference: (theme: ThemePreference) => void; toggle: () => void } {
  const prefs = useSyncExternalStore(subscribeDisplayPrefs, getDisplayPrefs, getDisplayPrefs);
  const resolved = resolveTheme(prefs.theme);

  const setPreference = useCallback((theme: ThemePreference) => saveDisplayPrefs({ ...getDisplayPrefs(), theme }), []);
  /** Flip between light and dark. Picking one explicitly stops following the device. */
  const toggle = useCallback(() => {
    const showing = resolveTheme(getDisplayPrefs().theme);
    saveDisplayPrefs({ ...getDisplayPrefs(), theme: showing === 'dark' ? 'light' : 'dark' });
  }, []);

  return { preference: prefs.theme, resolved, setPreference, toggle };
}
