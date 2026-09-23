import { isSameDay } from '@/lib/dates';
import type { Message } from '@/types/domain';

export type TimelineItem = { kind: 'day'; key: string; at: string } | { kind: 'message'; key: string; message: Message; startsRun: boolean };

/** Add `incoming` messages that are not in `current` yet, keeping oldest first. */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  return fresh.length ? [...current, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : current;
}

/**
 * Turn messages into what the list shows: a divider whenever the day changes, and each text message
 * marked as starting a run when the one before it is from someone else (so the name and picture show once).
 */
export function buildTimeline(messages: Message[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: Message | undefined;
  for (const message of messages) {
    const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
    if (newDay) items.push({ kind: 'day', key: `day-${message.id}`, at: message.createdAt });
    const startsRun = newDay || !previous || previous.kind !== 'text' || message.kind !== 'text' || previous.authorId !== message.authorId;
    items.push({ kind: 'message', key: message.id, message, startsRun });
    previous = message;
  }
  return items;
}
