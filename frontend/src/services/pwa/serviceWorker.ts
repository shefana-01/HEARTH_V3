/**
 * Registers the service worker (offline app shell, push notifications) and tells the page when a new
 * version of Hearth has been downloaded, so it can offer a reload instead of switching under the person.
 */
import { registerSW } from 'virtual:pwa-register';

export const UPDATE_READY_EVENT = 'hearth:update-ready';
let update: ((reload?: boolean) => Promise<void>) | null = null;

export function startServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new Event(UPDATE_READY_EVENT));
    },
    onRegisterError(error: unknown) {
      console.warn('Service worker registration failed', error);
    },
  });
}

/** Switch to the downloaded version and reload. */
export function applyUpdate(): void {
  if (update) void update(true);
  else window.location.reload();
}

export async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}
