import { describe, expect, it } from 'vitest';
import { slotsOf } from './medicationService';
import { daysText, timesText } from '@/features/health/medicineText';

const at = (d: Date) => `${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('medicine schedules', () => {
  it('lists each dose time on the chosen days between the first and last day', () => {
    // 2 Nov 2026 is a Monday. Mondays and Thursdays at 08:00 and 20:00, 4 to 12 November.
    const slots = slotsOf(
      { times: ['20:00', '08:00'], days: [true, false, false, true, false, false, false], startDate: '2026-11-04', endDate: '2026-11-12' },
      new Date(2026, 10, 1),
      new Date(2026, 10, 30),
    );
    expect(slots.map(at)).toEqual(['5 08:00', '5 20:00', '9 08:00', '9 20:00', '12 08:00', '12 20:00']);
  });

  it('describes a schedule in plain words', () => {
    expect(daysText([true, true, true, true, true, true, true])).toBe('Every day');
    expect(daysText([true, true, true, true, true, false, false])).toBe('Weekdays');
    expect(daysText([true, false, false, true, false, false, false])).toBe('Mon, Thu');
    expect(timesText(['08:30', '21:00'])).toMatch(/^8:30\sAM and 9:00\sPM$/);
  });
});
