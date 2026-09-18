import type { Params } from 'react-router-dom';

/**
 * Per-route metadata for the mobile app bar. Routes with `back` are "pushed" detail
 * screens: on phones they show a back button and title instead of the logo, and hide
 * the bottom tab bar. `back` is the logical parent, not browser history, so it also
 * works when the page was opened from a link or notification.
 */
export interface RouteMeta {
  title: string;
  back: (params: Params, search: string) => string;
}

export const detail = (title: string, back: RouteMeta['back'] | string): { handle: RouteMeta } => ({
  handle: { title, back: typeof back === 'string' ? () => back : back },
});

export function isRouteMeta(handle: unknown): handle is RouteMeta {
  return typeof handle === 'object' && handle !== null && 'back' in handle && 'title' in handle;
}
