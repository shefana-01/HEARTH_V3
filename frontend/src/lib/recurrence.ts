/**
 * Turning personal events into concrete blocks of busy time.
 *
 * A weekly event ("Data Structures, Sun & Tue 10:00") is stored once and
 * expanded on demand for the range someone is looking at. Pure functions: the
 * backend has a line-by-line port (`Recurrence.java`) and both are checked
 * against the same scenarios.
 */
import type { BusyBlock, PersonalEvent } from '@/types/domain';

const MIN = 60_000;
const DAY = 86_400_000;

const startOfLocalDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** yyyy-mm-dd of a local date, used in occurrence ids. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Every occurrence of `events` that overlaps [from, to), earliest first.
 * `label` is the event title; callers decide whether the viewer may see it.
 */
export function expandEvents(events: PersonalEvent[], from: number, to: number): BusyBlock[] {
  const blocks: BusyBlock[] = [];
  for (const event of events) {
    const first = new Date(event.start).getTime();
    const length = event.durationMin * MIN;

    if (event.repeat !== 'weekly') {
      if (first < to && first + length > from) {
        blocks.push({
          id: event.id,
          eventId: event.id,
          memberId: event.memberId,
          label: event.title,
          hidden: event.visibility === 'busy',
          start: event.start,
          end: new Date(first + length).toISOString(),
        });
      }
      continue;
    }

    const firstDate = new Date(first);
    const lastDay = event.until ? startOfLocalDay(new Date(event.until).getTime()).getTime() : Number.POSITIVE_INFINITY;
    // Start one day early so an occurrence that began yesterday and runs past midnight is included.
    const day = startOfLocalDay(Math.max(first, from - DAY));
    for (; day.getTime() < to && day.getTime() <= lastDay; day.setDate(day.getDate() + 1)) {
      if (!event.days[(day.getDay() + 6) % 7]) continue;
      const start = new Date(day);
      start.setHours(firstDate.getHours(), firstDate.getMinutes(), 0, 0);
      const startMs = start.getTime();
      if (startMs < first || startMs >= to || startMs + length <= from) continue;
      blocks.push({
        id: `${event.id}@${dayKey(day)}`,
        eventId: event.id,
        memberId: event.memberId,
        label: event.title,
        hidden: event.visibility === 'busy',
        start: start.toISOString(),
        end: new Date(startMs + length).toISOString(),
      });
    }
  }
  return blocks.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/** How far ahead the decision engine looks for busy time. */
export const BUSY_LOOKBACK_MS = DAY;
export const BUSY_HORIZON_MS = 45 * DAY;
