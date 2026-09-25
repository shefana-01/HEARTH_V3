import { WEEKDAY_LABELS } from '@/constants/labels';
import { formatShortDate, formatTimeRange, formatWeekdayShort } from '@/lib/dates';
import type { PersonalEvent } from '@/types/domain';

const MIN = 60_000;

const endOf = (event: PersonalEvent) => new Date(new Date(event.start).getTime() + event.durationMin * MIN).toISOString();

/** “Every Mon, Wed · 9:00 AM – 10:30 AM” or “Mon, Oct 12 · 2:00 PM – 4:00 PM”. */
export function recurrenceLine(event: PersonalEvent): string {
  const time = formatTimeRange(event.start, endOf(event));
  if (event.repeat === 'none') return `${formatWeekdayShort(event.start)}, ${formatShortDate(event.start)} · ${time}`;
  const chosen = WEEKDAY_LABELS.filter((_, i) => event.days[i]);
  const days = chosen.length === 7 ? 'Every day' : `Every ${chosen.join(', ')}`;
  return `${days} · ${time}${event.until ? ` · until ${formatShortDate(event.until)}` : ''}`;
}

/** Nothing left to happen: a one-off in the past, or a weekly event that has ended. */
export function isFinished(event: PersonalEvent, now: number = Date.now()): boolean {
  if (event.repeat === 'weekly') return event.until ? new Date(event.until).getTime() < now : false;
  return new Date(endOf(event)).getTime() < now;
}
