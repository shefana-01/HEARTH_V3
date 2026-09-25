import type { FamilyMember } from '@/types/domain';

/** What a member can be given access to, with the sentence shown under each switch. */
export const ACCESS_SCOPES: { key: keyof FamilyMember['access']; label: string; description: string }[] = [
  { key: 'schedule', label: 'Schedule', description: 'See the family schedule' },
  { key: 'medical', label: 'Health notes', description: 'See health notes that people share and those of people the family looks after' },
  { key: 'documents', label: 'Documents', description: 'See family documents' },
];
