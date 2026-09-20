/**
 * Personal events: classes, work shifts and anything else on one person's own
 * calendar — task-service.
 *
 * Only the owner can add, change or remove their events. Other family members
 * get them back with the title hidden when the owner chose "show as busy".
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { actorId, db, fail, newId, notFound, nowIso, persist, requireFamily, respond } from '../mockStore';
import type { PersonalEvent, PersonalEventInput } from '@/types/domain';

/** What someone else is allowed to know about an event. */
const forViewer = (e: PersonalEvent): PersonalEvent => (e.memberId === actorId() || e.visibility === 'details' ? e : { ...e, title: 'Busy', location: '' });

function clean(input: PersonalEventInput): PersonalEventInput {
  return {
    ...input,
    title: input.title.trim(),
    location: input.location.trim(),
    days: input.repeat === 'weekly' ? input.days : [false, false, false, false, false, false, false],
    until: input.repeat === 'weekly' ? input.until : undefined,
  };
}

function problem(input: PersonalEventInput): string | null {
  if (!input.title.trim()) return 'Give the event a name.';
  if (!(input.durationMin >= 5 && input.durationMin <= 1440)) return 'An event lasts between 5 minutes and 24 hours.';
  if (input.repeat === 'weekly' && !input.days.some(Boolean)) return 'Choose at least one day of the week.';
  if (input.repeat === 'weekly' && input.until && new Date(input.until).getTime() < new Date(input.start).getTime()) return 'The last day must be after the first one.';
  return null;
}

export const eventService = {
  /** Events of one member (default: the signed-in person), earliest first. */
  async list(memberId?: string): Promise<PersonalEvent[]> {
    if (!config.useMocks) return apiRequest<PersonalEvent[]>(`/events${query({ memberId })}`);
    const owner = memberId ?? actorId();
    return respond(
      db.events
        .filter((e) => e.memberId === owner)
        .map(forViewer)
        .sort((a, b) => a.start.localeCompare(b.start)),
    );
  },

  async get(id: string): Promise<PersonalEvent> {
    if (!config.useMocks) return apiRequest<PersonalEvent>(`/events/${id}`);
    const event = db.events.find((e) => e.id === id);
    return event ? respond(forViewer(event)) : notFound('That event');
  },

  async create(input: PersonalEventInput): Promise<PersonalEvent> {
    if (!config.useMocks) return apiRequest<PersonalEvent>('/events', { method: 'POST', body: input });
    requireFamily();
    const error = problem(input);
    if (error) return fail(error, 422);
    const event: PersonalEvent = { ...clean(input), id: newId('ev'), memberId: actorId(), createdAt: nowIso() };
    db.events.push(event);
    persist();
    return respond(event);
  },

  async update(id: string, input: PersonalEventInput): Promise<PersonalEvent> {
    if (!config.useMocks) return apiRequest<PersonalEvent>(`/events/${id}`, { method: 'PUT', body: input });
    const event = db.events.find((e) => e.id === id && e.memberId === actorId());
    if (!event) return notFound('That event');
    const error = problem(input);
    if (error) return fail(error, 422);
    Object.assign(event, clean(input));
    persist();
    return respond(event);
  },

  async remove(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/events/${id}`, { method: 'DELETE' });
    if (!db.events.some((e) => e.id === id && e.memberId === actorId())) return notFound('That event');
    db.events = db.events.filter((e) => e.id !== id);
    persist();
    return respond(undefined);
  },
};
