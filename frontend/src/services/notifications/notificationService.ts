/**
 * In-app notifications — notification-service, which builds them from the
 * Kafka events the other services publish.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, db, persist, respond } from '../mockStore';
import type { NotificationItem } from '@/types/domain';

type Listener = (unread: number) => void;
const listeners = new Set<Listener>();

/** With the API: the last unread count we were told, refreshed by polling. */
let remoteUnread = 0;
let pollTimer: number | undefined;
const POLL_MS = 30_000;

/** Family-wide notifications, plus the ones addressed to the signed-in person. */
const mine = (n: NotificationItem) => !n.forId || n.forId === actorId();

const unreadCount = () => (config.useMocks ? db.notifications.filter((n) => mine(n) && !n.read).length : remoteUnread);
const emit = () => listeners.forEach((l) => l(unreadCount()));

async function refreshFromApi(): Promise<void> {
  try {
    remoteUnread = (await apiRequest<{ unread: number }>('/notifications/unread-count')).unread;
    emit();
  } catch {
    /* signed out or offline — keep the last known count */
  }
}

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
    if (!config.useMocks) {
      const items = await apiRequest<NotificationItem[]>('/notifications');
      remoteUnread = items.filter((n) => !n.read).length;
      emit();
      return items;
    }
    return respond(db.notifications.filter(mine).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  unreadCount,

  /** Subscribe to unread-count changes. With the API the count is polled (a push channel can replace this). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    if (!config.useMocks && pollTimer === undefined) {
      void refreshFromApi();
      pollTimer = window.setInterval(() => void refreshFromApi(), POLL_MS);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && pollTimer !== undefined) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };
  },

  /** Check for new notifications now (e.g. after navigating). */
  refresh(): void {
    if (config.useMocks) emit();
    else void refreshFromApi();
  },

  async markRead(id: string): Promise<void> {
    if (!config.useMocks) {
      await apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' });
      return refreshFromApi();
    }
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    persist();
    emit();
    return respond(undefined);
  },

  async markAllRead(): Promise<void> {
    if (!config.useMocks) {
      await apiRequest<void>('/notifications/read-all', { method: 'POST' });
      return refreshFromApi();
    }
    db.notifications.filter(mine).forEach((n) => (n.read = true));
    persist();
    emit();
    return respond(undefined);
  },

  async dismiss(id: string): Promise<void> {
    if (!config.useMocks) {
      await apiRequest<void>(`/notifications/${id}`, { method: 'DELETE' });
      return refreshFromApi();
    }
    db.notifications = db.notifications.filter((n) => n.id !== id);
    persist();
    emit();
    return respond(undefined);
  },
};
