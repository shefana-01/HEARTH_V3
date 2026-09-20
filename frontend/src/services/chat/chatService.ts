/**
 * Family chat and task comments — notification-service.
 *
 * Two kinds of channel share one message shape: `family` is the group chat
 * everyone in the family is in, and `task:<id>` is the comment thread under a
 * single task. With the API, new messages are picked up by polling.
 *
 * MOCK: there is one account per browser, so nobody answers. The sample
 * family comes with a conversation so the screen can be tried.
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { actorId, canSeeTask, db, fail, newId, notFound, nowIso, persist, requireFamily, respond } from '../mockStore';
import type { Channel, Message } from '@/types/domain';

export const MAX_MESSAGE_LENGTH = 1000;

type Listener = (unread: number) => void;
const listeners = new Set<Listener>();

let remoteUnread = 0;
let pollTimer: number | undefined;
const POLL_MS = 20_000;

/** Unread messages in the family chat written by other people. */
function localUnread(): number {
  const since = db.chatReadAt.family ?? '';
  return db.messages.filter((m) => m.channel === 'family' && m.kind !== 'system' && m.authorId !== actorId() && m.createdAt > since).length;
}

const unreadCount = () => (config.useMocks ? localUnread() : remoteUnread);
const emit = () => listeners.forEach((l) => l(unreadCount()));

async function refreshFromApi(): Promise<void> {
  try {
    remoteUnread = (await apiRequest<{ unread: number }>('/messages/unread-count')).unread;
    emit();
  } catch {
    /* signed out or offline — keep the last known count */
  }
}

/** A task thread is only open to people who can see the task. */
function allowed(channel: Channel): boolean {
  if (channel === 'family') return true;
  const task = db.tasks.find((t) => t.id === channel.slice('task:'.length));
  return Boolean(task && canSeeTask(task));
}

export const taskChannel = (taskId: string): Channel => `task:${taskId}`;

export const chatService = {
  /** Messages in a channel, oldest first. `after` returns only newer ones (used when polling). */
  async list(channel: Channel, after?: string): Promise<Message[]> {
    if (!config.useMocks) return apiRequest<Message[]>(`/messages${query({ channel, after })}`);
    if (!allowed(channel)) return notFound('That conversation');
    return respond(db.messages.filter((m) => m.channel === channel && (!after || m.createdAt > after)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  },

  async send(channel: Channel, text: string): Promise<Message> {
    const body = text.trim();
    if (!config.useMocks) return apiRequest<Message>('/messages', { method: 'POST', body: { channel, text: body } });
    requireFamily();
    if (!allowed(channel)) return notFound('That conversation');
    if (!body) return fail('Write a message first.', 422);
    if (body.length > MAX_MESSAGE_LENGTH) return fail(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`, 422);
    const message: Message = { id: newId('msg'), channel, authorId: actorId(), kind: 'text', text: body, createdAt: nowIso() };
    db.messages.push(message);
    db.chatReadAt[channel] = message.createdAt;
    persist();
    return respond(message);
  },

  /** Remember that the signed-in person has seen everything in the channel. */
  async markRead(channel: Channel): Promise<void> {
    if (!config.useMocks) {
      await apiRequest<void>('/messages/read', { method: 'POST', body: { channel } });
      if (channel === 'family') {
        remoteUnread = 0;
        emit();
      }
      return;
    }
    db.chatReadAt[channel] = nowIso();
    persist();
    emit();
    return respond(undefined);
  },

  /** How many comments each task has, for the badge on a task. */
  async countByTask(): Promise<Record<string, number>> {
    if (!config.useMocks) return apiRequest<Record<string, number>>('/messages/task-counts');
    const counts: Record<string, number> = {};
    for (const m of db.messages) {
      if (m.channel === 'family' || m.kind !== 'text') continue;
      const id = m.channel.slice('task:'.length);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return respond(counts);
  },

  unreadCount,

  /** Subscribe to the family chat's unread count. With the API the count is polled. */
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

  refresh(): void {
    if (config.useMocks) emit();
    else void refreshFromApi();
  },
};
