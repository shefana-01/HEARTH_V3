/**
 * Calendar sync — task-service.
 *
 * A private address (iCalendar) that Google Calendar, Apple Calendar or Outlook subscribe to: your tasks,
 * your own events and your time away, kept up to date by the calendar app. The token in the address is the
 * secret, so it is shown only when made; a new one replaces the old one.
 *
 * In demo mode there is no server for a calendar app to reach, so the plan is offered as a .ics download.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, db, respond } from '../mockStore';
import { downloadFile } from '@/lib/download';
import { expandEvents } from '@/lib/recurrence';
import { buildCalendar } from '@/lib/ics';

export interface CalendarFeed {
  active: boolean;
  createdAt?: string;
  lastFetchedAt?: string;
  /** Only right after the address was made. */
  token?: string;
}

/** The full https address, and the webcal:// form calendar apps open directly. */
export function feedUrls(token: string): { https: string; webcal: string; google: string } {
  const https = new URL(`${config.apiBaseUrl}/calendar/feeds/${token}.ics`, window.location.origin).href;
  const webcal = https.replace(/^https?:/, 'webcal:');
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

export const calendarService = {
  async status(): Promise<CalendarFeed> {
    if (config.useMocks) return respond({ active: false });
    return apiRequest<CalendarFeed>('/calendar/feed');
  },

  async create(): Promise<CalendarFeed> {
    return apiRequest<CalendarFeed>('/calendar/feed', { method: 'POST' });
  },

  async remove(): Promise<void> {
    return apiRequest<void>('/calendar/feed', { method: 'DELETE' });
  },

  /** Demo: my tasks and events for the next 180 days as one .ics file. */
  downloadMyPlan(): void {
    const me = actorId();
    const now = Date.now();
    const from = now - 30 * 86_400_000;
    const to = now + 180 * 86_400_000;
    const tasks = db.tasks.filter((t) => t.assigneeId === me && t.status !== 'cancelled' && new Date(t.start).getTime() >= from && new Date(t.start).getTime() <= to);
    const events = expandEvents(
      db.events.filter((e) => e.memberId === me),
      from,
      to,
    );
    const body = buildCalendar('Hearth', [
      ...tasks.map((t) => ({ uid: `task-${t.id}@hearth`, title: t.title, start: t.start, durationMin: t.durationMin, description: t.notes })),
      ...events.map((e) => ({ uid: `event-${e.id}@hearth`, title: e.label, start: e.start, durationMin: Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60_000) })),
    ]);
    downloadFile('hearth-my-plan.ics', body, 'text/calendar');
  },
};
