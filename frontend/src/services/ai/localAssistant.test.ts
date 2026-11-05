import { describe, expect, it } from 'vitest';
import { readNote, splitNote, type RosterPerson } from './localAssistant';

const roster: RosterPerson[] = [
  { id: 'a', name: 'Afsara Mannan', kind: 'member', takesTasks: true },
  { id: 'r', name: 'Rafid Mannan', kind: 'member', takesTasks: true },
  { id: 'n', name: 'Nanu Begum', kind: 'member', takesTasks: false },
  { id: 'g', name: 'Rahima Khatun', kind: 'dependant', takesTasks: false },
];
// Thursday 5 November 2026, 10:00 local time.
const now = new Date(2026, 10, 5, 10, 0);
const local = (d: string) => {
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

describe('the offline assistant', () => {
  it('splits a note into one task per line, semicolon or sentence', () => {
    expect(splitNote('Buy rice; call aunt\nPay the bill. Gym at 7')).toEqual(['Buy rice', 'call aunt', 'Pay the bill.', 'Gym at 7']);
  });

  it('reads day, time, people, category and duration', () => {
    const { drafts } = readNote('Buy rice and lentils tomorrow 6pm; Rafid takes Rahima to the dentist Tuesday at 4:30', roster, roster[0], now);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ title: 'Buy rice and lentils', category: 'errands', assigneeId: 'a', durationMin: 60 });
    expect(local(drafts[0].start)).toBe('6/11 18:00');
    expect(drafts[1]).toMatchObject({ title: 'Take Rahima to the dentist', category: 'health', priority: 'important', assigneeId: 'r', forId: 'g', reminder: true });
    expect(local(drafts[1].start)).toBe('10/11 16:30');
  });

  it('understands Bengali time words and digits', () => {
    const { drafts } = readNote('কাল বিকাল ৪টায় বাজার করা', roster, roster[0], now);
    expect(drafts[0].title).toBe('বাজার করা');
    expect(drafts[0].category).toBe('errands');
    expect(local(drafts[0].start)).toBe('6/11 16:00');
  });

  it('never gives a task to someone who cannot take tasks, and says so', () => {
    const { drafts, assumptions } = readNote('Nanu waters the plants at 5pm', roster, roster[0], now);
    expect(drafts[0].assigneeId).toBe('a');
    expect(assumptions.join(' ')).toMatch(/Nanu can’t take tasks/);
  });

  it('a missing time today becomes the next hour, and a missing day the next time that hour comes', () => {
    expect(local(readNote('urgent: pay electricity bill today', roster, roster[0], now).drafts[0].start)).toBe('5/11 11:00');
    expect(readNote('urgent: pay electricity bill today', roster, roster[0], now).drafts[0].priority).toBe('urgent');
    expect(local(readNote('Gym at 7 am', roster, roster[0], now).drafts[0].start)).toBe('6/11 07:00');
    expect(local(readNote('Call aunt on 12 Nov at 11am for 20 min', roster, roster[0], now).drafts[0].start)).toBe('12/11 11:00');
    expect(readNote('Call aunt on 12 Nov at 11am for 20 min', roster, roster[0], now).drafts[0].durationMin).toBe(20);
  });
});
