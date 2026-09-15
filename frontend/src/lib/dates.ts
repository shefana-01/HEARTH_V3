/**
 * Date helpers.
 *
 * Mock data is generated relative to "today" (see `at`) so the demo always
 * looks current instead of being frozen on the dates baked into the designs.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO timestamp for `dayOffset` days from today at local time `hhmm` ("17:30"). */
export function at(dayOffset: number, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = startOfDay();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** ISO timestamp `minutes` ago. */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MS_PER_MINUTE).toISOString();
}

export function dayDiff(iso: string, from: Date = new Date()): number {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const weekdayShortFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const fullDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatShortDate = (iso: string) => shortDateFmt.format(new Date(iso));
export const formatLongDate = (iso: string | Date) => longDateFmt.format(new Date(iso));
export const formatWeekday = (iso: string | Date) => weekdayFmt.format(new Date(iso));
export const formatWeekdayShort = (iso: string | Date) => weekdayShortFmt.format(new Date(iso));
export const formatFullDate = (iso: string) => fullDateFmt.format(new Date(iso));

export function formatTimeRange(start: string, end?: string): string {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** "Today", "Tomorrow", "Yesterday", or "Mon, Oct 21". */
export function formatRelativeDay(iso: string): string {
  const diff = dayDiff(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${formatWeekdayShort(iso)}, ${formatShortDate(iso)}`;
}

/** "Today, 5:00 PM" */
export function formatDayTime(iso: string): string {
  return `${formatRelativeDay(iso)}, ${formatTime(iso)}`;
}

export function durationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_MINUTE);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "12m ago", "2h ago", "Yesterday", "3 days ago". */
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / MS_PER_MINUTE));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24 && dayDiff(iso) === 0) return `${hours}h ago`;
  const days = -dayDiff(iso);
  if (days <= 1) return 'Yesterday';
  return `${days} days ago`;
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Monday-based week containing `date`. */
export function weekDays(date: Date = new Date()): Date[] {
  const d = startOfDay(date);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
}

/** yyyy-mm-dd in local time, for <input type="date">. */
export function toDateInputValue(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Combine yyyy-mm-dd and HH:mm (local) into an ISO string. */
export function combineDateTime(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

/** "17:30" → "5:30 PM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatTime(d.toISOString());
}
