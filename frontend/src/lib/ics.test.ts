import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeIcs, foldLine } from './ics';

const octets = (s: string) => new TextEncoder().encode(s).length;

describe('iCalendar files', () => {
  it('escapes text values', () => {
    expect(escapeIcs('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('folds long lines at 75 octets without splitting a Bengali character', () => {
    const line = `SUMMARY:${'ডাক্তারের কাছে দাদুকে নিয়ে যাওয়া এবং ওষুধ কিনে আনা'.repeat(2)}`;
    const folded = foldLine(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    folded.forEach((l, i) => {
      expect(octets(l)).toBeLessThanOrEqual(75);
      if (i > 0) expect(l.startsWith(' ')).toBe(true);
    });
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(line);
  });

  it('builds a calendar with one event per item, in UTC', () => {
    const body = buildCalendar('Hearth', [{ uid: 't1@hearth', title: 'Buy rice, lentils', start: '2026-11-05T12:00:00.000Z', durationMin: 30 }]);
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(body).toContain('DTSTART:20261105T120000Z\r\nDTEND:20261105T123000Z\r\nSUMMARY:Buy rice\\, lentils\r\n');
    expect(body.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
