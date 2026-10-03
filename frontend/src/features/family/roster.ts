import { downloadFile, slugify, toCsv } from '@/lib/download';
import { ROLES, SKILLS, WEEKDAY_LABELS } from '@/constants/labels';
import type { FamilyMember } from '@/types/domain';

function availabilitySummary(m: FamilyMember): string {
  const days = WEEKDAY_LABELS.filter((_, i) => m.availability.days[i]);
  if (!days.length) return 'No days set';
  if (days.length === 7) return 'Every day';
  if (days.join() === 'Mon,Tue,Wed,Thu,Fri') return 'Weekdays';
  if (days.join() === 'Sat,Sun') return 'Weekends';
  return days.join(', ');
}

/** Download the family's members as a spreadsheet-friendly CSV file. */
export function exportRoster(familyName: string, members: FamilyMember[]): void {
  const rows = [
    ['Name', 'Relationship', 'Role', 'Status', 'Email', 'Phone', 'Usually handles', 'Can help with', 'Free on'],
    ...members.map((m) => [m.name, m.relation, ROLES[m.role].label, m.status, m.email, m.phone ?? '', m.focus, m.skills.map((s) => SKILLS[s]).join('; '), availabilitySummary(m)]),
  ];
  downloadFile(`${slugify(familyName) || 'family'}-people.csv`, toCsv(rows), 'text/csv');
}
