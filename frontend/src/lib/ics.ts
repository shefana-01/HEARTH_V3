import { downloadFile, slugify } from './download';

/**
 * iCalendar (RFC 5545) for downloads: escaped text, CRLF line endings, and lines folded at 75 octets
 * without splitting a UTF-8 character (Bengali titles stay intact). Times are UTC, so no VTIMEZONE is needed.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  start: string;
  durationMin: number;
  location?: string;
  description?: string;
}

const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export const escapeIcs = (s = '') =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (m) => `\\${m}`)
    .replace(/\r\n|\r|\n/g, '\\n');

const encoder = new TextEncoder();

/** Folds one content line: continuation lines start with a single space. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
      limit = 74;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildCalendar(name: string, events: IcsEvent[]): string {
  const stamp = utc(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hearth//Family organiser//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeIcs(name)}`];
  for (const e of events) {
    const begin = new Date(e.start);
    const end = new Date(begin.getTime() + e.durationMin * 60_000);
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`, `DTSTART:${utc(begin)}`, `DTEND:${utc(end)}`, `SUMMARY:${escapeIcs(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Build and download an iCalendar (.ics) file so a visit can be added to any calendar app. */
export function downloadIcs({ title, start, durationMin, location, description }: { title: string; start: string; durationMin: number; location?: string; description?: string }) {
  const body = buildCalendar('Hearth', [{ uid: `${crypto.randomUUID()}@hearth`, title, start, durationMin, location, description }]);
  downloadFile(`${slugify(title) || 'appointment'}.ics`, body, 'text/calendar');
}
