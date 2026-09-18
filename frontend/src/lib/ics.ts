import { downloadFile, slugify } from './download';
/** Build and download an iCalendar (.ics) file so a visit can be added to any calendar app. */
export function downloadIcs({ title, start, durationMin, location, description }: { title: string; start: string; durationMin: number; location?: string; description?: string }) {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (s = '') =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/[,;]/g, (m) => `\\${m}`)
      .replace(/\n/g, '\\n');
  const begin = new Date(start);
  const end = new Date(begin.getTime() + durationMin * 60_000);
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hearth//Family Care//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@hearth`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(begin)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(title)}`,
    location ? `LOCATION:${escape(location)}` : '',
    description ? `DESCRIPTION:${escape(description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
  downloadFile(`${slugify(title) || 'appointment'}.ics`, body, 'text/calendar');
}
