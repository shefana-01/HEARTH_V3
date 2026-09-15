/**
 * In-app notifications — notification-service (fed by Kafka domain events in
 * the target architecture). REST contract: not defined yet.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { db, persist, respond } from '../mockStore';
import type { NotificationItem } from '@/types/domain';

type Listener = (unread: number) => void;
const listeners = new Set<Listener>();
const unreadCount = () => db.notifications.filter((n) => !n.read).length;
const emit = () => listeners.forEach((l) => l(unreadCount()));

export const notificationService = {
  async list(): Promise<NotificationItem[]> {
    if (!config.useMocks) return backendNotConnected('notification-service', 'listNotifications');
    return respond([...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  unreadCount,

  /** Subscribe to unread-count changes (replaced by a push channel later). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Let other services announce that new notifications may exist. */
  refresh: emit,

  async markRead(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('notification-service', 'markRead');
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    persist();
    emit();
    return respond(undefined);
  },

  async markAllRead(): Promise<void> {
    if (!config.useMocks) return backendNotConnected('notification-service', 'markAllRead');
    db.notifications.forEach((n) => (n.read = true));
    persist();
    emit();
    return respond(undefined);
  },

  async dismiss(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('notification-service', 'dismiss');
    db.notifications = db.notifications.filter((n) => n.id !== id);
    persist();
    emit();
    return respond(undefined);
  },
};
