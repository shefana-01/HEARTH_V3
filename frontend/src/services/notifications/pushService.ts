/**
 * Push notifications on this device — notification-service.
 *
 * With the backend: the browser subscribes with the server's VAPID public key and the subscription is
 * saved, so notifications arrive even when Hearth is closed. In demo mode there is no server to send them,
 * so "device notifications" means reminders appear as system notifications while Hearth is open.
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { readJSON, writeJSON } from '@/lib/storage';
import { serviceWorkerRegistration } from '../pwa/serviceWorker';

export interface PushState {
  /** This browser can do push at all (service worker, PushManager, Notification). */
  supported: boolean;
  /** The server has push set up (VAPID keys). Always true in demo mode. */
  available: boolean;
  /** This device is subscribed (demo: device notifications are on). */
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  /** Devices the person has turned push on for (backend only). */
  devices: number;
}

const DEMO_KEY = 'hearth.deviceNotifications';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** VAPID public key (base64url) → the bytes PushManager.subscribe expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await serviceWorkerRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export const pushService = {
  async getState(): Promise<PushState> {
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    if (config.useMocks) {
      const on = readJSON<boolean>(DEMO_KEY, false) && permission === 'granted';
      return { supported: 'Notification' in window, available: true, enabled: on, permission, devices: on ? 1 : 0 };
    }
    const server = await apiRequest<{ enabled: boolean; publicKey?: string; devices: number }>('/notifications/push');
    const subscription = supported() ? await currentSubscription() : null;
    return { supported: supported(), available: server.enabled, enabled: Boolean(subscription) && permission === 'granted', permission, devices: server.devices };
  },

  async enable(): Promise<void> {
    if (!('Notification' in window)) throw new Error('This browser can’t show notifications.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notifications are blocked for Hearth. Allow them in your browser’s site settings, then try again.');
    if (config.useMocks) {
      writeJSON(DEMO_KEY, true);
      return;
    }
    if (!supported()) throw new Error('This browser doesn’t support push notifications. On iPhone, add Hearth to your Home Screen first.');
    const server = await apiRequest<{ enabled: boolean; publicKey?: string }>('/notifications/push');
    if (!server.enabled || !server.publicKey) throw new Error('Push notifications aren’t set up on this Hearth yet.');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(server.publicKey) as BufferSource });
    }
    const json = subscription.toJSON();
    await apiRequest<void>('/notifications/push/subscriptions', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
  },

  async disable(): Promise<void> {
    if (config.useMocks) {
      writeJSON(DEMO_KEY, false);
      return;
    }
    const subscription = await currentSubscription();
    if (!subscription) return;
    try {
      await apiRequest<void>(`/notifications/push/subscriptions${query({ endpoint: subscription.endpoint })}`, { method: 'DELETE' });
    } finally {
      await subscription.unsubscribe();
    }
  },

  /** Shows a notification on this device now (a test, or a demo reminder). */
  async showLocal(title: string, body: string, url = '/notifications'): Promise<boolean> {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    if (config.useMocks && !readJSON<boolean>(DEMO_KEY, false)) return false;
    const registration = await serviceWorkerRegistration();
    const options: NotificationOptions = { body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url } };
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
    return true;
  },
};
