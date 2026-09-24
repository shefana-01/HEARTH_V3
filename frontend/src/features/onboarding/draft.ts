import { INVITE_CODE } from '@/constants/invite';
import { WEEKDAY_LABELS } from '@/constants/labels';
import { email as emailRule, required, validate } from '@/lib/validation';
import type { InviteInput } from '@/services/family/familyService';
import type { EventKind } from '@/types/domain';

export const DRAFT_KEY = 'hearth.onboarding-draft.v2';

export type StepId = 'welcome' | 'path' | 'family' | 'people' | 'week' | 'invite' | 'review';

export const STEPS: { id: StepId; title: string; hint: string }[] = [
  { id: 'welcome', title: 'Welcome', hint: 'What Hearth does' },
  { id: 'path', title: 'Choose a path', hint: 'New space or join one' },
  { id: 'family', title: 'Your family space', hint: 'Name and place' },
  { id: 'people', title: 'People you look after', hint: 'Optional' },
  { id: 'week', title: 'Your week', hint: 'When you are busy' },
  { id: 'invite', title: 'Invite your family', hint: 'Optional' },
  { id: 'review', title: 'Review & finish', hint: 'Check and create' },
];

export interface DependantRow {
  key: string;
  name: string;
  relation: string;
}

export interface CommitmentRow {
  key: string;
  title: string;
  kind: EventKind;
  /** Monday → Sunday. */
  days: boolean[];
  /** "HH:mm" */
  start: string;
  end: string;
}

export type InviteRow = InviteInput & { key: string };

export interface Draft {
  step: number;
  path: 'create' | 'join';
  inviteCode: string;
  familyName: string;
  location: string;
  myRelation: string;
  dependants: DependantRow[];
  commitments: CommitmentRow[];
  invites: InviteRow[];
}

export const EMPTY_DRAFT: Draft = {
  step: 0,
  path: 'create',
  inviteCode: '',
  familyName: '',
  location: '',
  myRelation: '',
  dependants: [],
  commitments: [],
  invites: [],
};

export type Errors = Record<string, string | undefined>;

export const newKey = () => crypto.randomUUID();

export const WEEKDAYS_ONLY = [true, true, true, true, true, false, false];

/** Replace the row with this key by itself plus `patch`. */
export function patchRow<T extends { key: string }>(rows: T[], key: string, patch: Partial<T>): T[] {
  return rows.map((row) => (row.key === key ? { ...row, ...patch } : row));
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** "Weekdays", "Every day" or "Mon, Wed". */
export function daysLabel(days: boolean[]): string {
  if (days.every(Boolean)) return 'Every day';
  if (days.every((on, i) => on === WEEKDAYS_ONLY[i])) return 'Weekdays';
  return WEEKDAY_LABELS.filter((_, i) => days[i]).join(', ');
}

export function validateStep(draft: Draft): Errors {
  const errors: Errors = {};
  const step = STEPS[draft.step].id;
  if (step === 'path' && draft.path === 'join') {
    errors.inviteCode = INVITE_CODE.test(draft.inviteCode.trim().toUpperCase()) ? undefined : 'Enter the code you received. It starts with HEARTH-.';
  }
  if (step === 'family') errors.familyName = validate(draft.familyName, required('Family name'));
  if (step === 'people') {
    draft.dependants.forEach((d, i) => {
      errors[`dependant-${i}`] = validate(d.name, required('Their name'));
    });
  }
  if (step === 'week') {
    draft.commitments.forEach((c, i) => {
      errors[`title-${i}`] = validate(c.title, required('A name'));
      if (!c.days.some(Boolean)) errors[`days-${i}`] = 'Choose at least one day.';
      if (!c.start || !c.end || minutesBetween(c.start, c.end) < 5) errors[`time-${i}`] = 'It needs to end at least 5 minutes after it starts.';
    });
  }
  if (step === 'invite') {
    draft.invites.forEach((inv, i) => {
      errors[`name-${i}`] = validate(inv.name, required('Name'));
      errors[`email-${i}`] = validate(inv.email, required('Email'), emailRule);
    });
    const emails = draft.invites.map((i) => i.email.trim().toLowerCase()).filter(Boolean);
    if (new Set(emails).size !== emails.length) errors.invites = 'Each person needs a different email address.';
  }
  return errors;
}
