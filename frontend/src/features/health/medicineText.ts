import { formatTime } from '@/lib/dates';
import { WEEKDAY_LABELS } from '@/constants/labels';
import type { DoseStatus, Medication } from '@/types/domain';

export const DOSE_LABELS: Record<DoseStatus, { label: string; tone: 'neutral' | 'primary' | 'mint' | 'amber' | 'red' }> = {
  upcoming: { label: 'Later', tone: 'neutral' },
  due: { label: 'Due now', tone: 'primary' },
  taken: { label: 'Taken', tone: 'mint' },
  skipped: { label: 'Skipped', tone: 'amber' },
  missed: { label: 'Missed', tone: 'red' },
};

/** "Every day", "Weekdays", "Mon, Thu". */
export function daysText(days: boolean[]): string {
  if (days.every(Boolean)) return 'Every day';
  if (days.slice(0, 5).every(Boolean) && !days[5] && !days[6]) return 'Weekdays';
  if (!days.slice(0, 5).some(Boolean) && days[5] && days[6]) return 'Weekends';
  return WEEKDAY_LABELS.filter((_, i) => days[i]).join(', ');
}

/** "8:30 AM and 9:00 PM" */
export function timesText(times: string[]): string {
  const labels = times.map((t) => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return formatTime(d.toISOString());
  });
  return labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export function scheduleText(m: Medication): string {
  return `${daysText(m.days)} at ${timesText(m.times)}`;
}
