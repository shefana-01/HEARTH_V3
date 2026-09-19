import type { TaskPriority, Tone } from '@/types/domain';

export const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export const currencyRange = (min: number, max: number) => `${currency(min).replace(/\.00$/, '')} – ${currency(max).replace(/\.00$/, '')}`;

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const PRIORITY_META: Record<TaskPriority, { label: string; tone: Tone }> = {
  routine: { label: 'Routine', tone: 'neutral' },
  important: { label: 'Important', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'rose' },
};
