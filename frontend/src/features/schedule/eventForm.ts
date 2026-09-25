import { combineDateTime, durationMinutes, toDateInputValue } from '@/lib/dates';
import { maxLength, required, validate } from '@/lib/validation';
import type { EventKind, PersonalEvent, PersonalEventInput } from '@/types/domain';

export interface EventFormState {
  title: string;
  kind: EventKind;
  /** yyyy-mm-dd of the first (or only) day. */
  date: string;
  startTime: string;
  endTime: string;
  repeat: PersonalEvent['repeat'];
  /** Monday → Sunday. `null` until the person picks days: the weekday of `date` is used then. */
  days: boolean[] | null;
  /** yyyy-mm-dd of the last day, or empty when it keeps going. */
  until: string;
  location: string;
  visibility: PersonalEvent['visibility'];
}

export type EventFormErrors = Partial<Record<'title' | 'date' | 'startTime' | 'endTime' | 'days' | 'until', string>>;

const NO_DAYS = [false, false, false, false, false, false, false];

const toTimeValue = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function initialState(existing?: PersonalEvent): EventFormState {
  if (!existing) {
    return { title: '', kind: 'class', date: toDateInputValue(), startTime: '09:00', endTime: '10:00', repeat: 'none', days: null, until: '', location: '', visibility: 'details' };
  }
  const start = new Date(existing.start);
  return {
    title: existing.title,
    kind: existing.kind,
    date: toDateInputValue(start),
    startTime: toTimeValue(start),
    endTime: toTimeValue(new Date(start.getTime() + existing.durationMin * 60_000)),
    repeat: existing.repeat,
    days: existing.repeat === 'weekly' ? existing.days : null,
    until: existing.until ? toDateInputValue(new Date(existing.until)) : '',
    location: existing.location,
    visibility: existing.visibility,
  };
}

/** Index (Monday = 0) of the weekday of a yyyy-mm-dd string, or -1 when there is no date yet. */
function weekdayIndex(date: string): number {
  return date ? (new Date(combineDateTime(date, '12:00')).getDay() + 6) % 7 : -1;
}

/** The days a weekly event happens on: the picked ones, or just the weekday of the first date. */
export function selectedDays(form: EventFormState): boolean[] {
  return form.days ?? NO_DAYS.map((_, i) => i === weekdayIndex(form.date));
}

function lengthOf(form: EventFormState): number {
  return durationMinutes(combineDateTime(form.date, form.startTime), combineDateTime(form.date, form.endTime));
}

export function validateForm(form: EventFormState): EventFormErrors {
  const length = form.date && form.startTime && form.endTime ? lengthOf(form) : undefined;
  return {
    title: validate(form.title, required('The name'), maxLength('The name', 100)),
    date: form.date ? undefined : 'Choose a date.',
    startTime: form.startTime ? undefined : 'Choose a start time.',
    endTime: !form.endTime
      ? 'Choose an end time.'
      : length === undefined
        ? undefined
        : length <= 0
          ? 'The end time must be after the start time.'
          : length < 5 || length > 1440
            ? 'An event lasts between 5 minutes and 24 hours.'
            : undefined,
    days: form.repeat === 'weekly' && !selectedDays(form).some(Boolean) ? 'Choose at least one day.' : undefined,
    until: form.repeat === 'weekly' && form.until && form.date && form.until < form.date ? 'The last day can’t be before the first day.' : undefined,
  };
}

/** Only call this once `validateForm` found nothing wrong. */
export function toInput(form: EventFormState): PersonalEventInput {
  const weekly = form.repeat === 'weekly';
  const [y, m, d] = form.until.split('-').map(Number);
  return {
    title: form.title.trim(),
    kind: form.kind,
    start: combineDateTime(form.date, form.startTime),
    durationMin: lengthOf(form),
    repeat: form.repeat,
    days: weekly ? selectedDays(form) : NO_DAYS,
    until: weekly && form.until ? new Date(y, m - 1, d, 23, 59, 59, 999).toISOString() : undefined,
    location: form.location.trim(),
    visibility: form.visibility,
  };
}
