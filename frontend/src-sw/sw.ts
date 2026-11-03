/// <reference lib="webworker" />
/**
 * Hearth's service worker.
 *
 * - Keeps the app itself (HTML, scripts, styles, icons) on the device, so Hearth opens instantly and works
 *   offline in demo mode. API responses are never cached: family data always comes fresh from the server.
 * - Shows push notifications sent by notification-service, and opens the right page when one is tapped.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page of the app is the same index.html (React Router decides what to show).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/actuator\//] }));

// The page asks for the new version when the person agrees to reload.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  id?: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const url = payload.url && payload.url.startsWith('/') ? payload.url : '/notifications';
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Hearth', {
      body: payload.body ?? 'Something changed in your family’s plan.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: payload.id ?? payload.tag,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | undefined)?.url ?? '/notifications', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// The browser replaced the subscription (keys rotated): tell open pages so they can register the new one.
self.addEventListener('pushsubscriptionchange', () => {
  void self.clients.matchAll({ type: 'window' }).then((windows) => windows.forEach((w) => w.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' })));
});
