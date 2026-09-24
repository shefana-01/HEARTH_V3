import type { ScheduleEvent } from '@/types/domain';

type Kind = ScheduleEvent['kind'];

const HATCH = 'bg-[repeating-linear-gradient(135deg,theme(colors.surface.sunken),theme(colors.surface.sunken)_6px,theme(colors.surface.muted)_6px,theme(colors.surface.muted)_12px)]';

/** How each kind of schedule item looks. The order is the order of the legend. */
export const KIND_STYLES: Record<Kind, { card: string; label: string; dot: string }> = {
  task: { card: 'border-primary-200 bg-primary-50 text-primary-900', label: 'Task', dot: 'bg-primary-500' },
  completed: { card: 'border-mint-200 bg-mint-50 text-mint-800', label: 'Done', dot: 'bg-mint-500' },
  conflict: { card: 'border-red-200 bg-red-50 text-red-700 ring-1 ring-red-200', label: 'Clash', dot: 'bg-red-500' },
  appointment: { card: 'border-rose-200 bg-rose-50 text-rose-700', label: 'Appointment', dot: 'bg-rose-500' },
  event: { card: 'border-amber-200 bg-amber-50 text-amber-700', label: 'Personal event', dot: 'bg-amber-500' },
  busy: { card: `border-dashed border-line-strong ${HATCH} text-ink-muted`, label: 'Busy', dot: 'bg-ink-subtle' },
  unavailable: { card: 'border-line bg-surface-sunken text-ink-muted', label: 'Away', dot: 'bg-line-strong' },
};

/** Tasks and appointments are what “hours of tasks” and “clash” counts are about. */
export const isTaskLike = (kind: Kind) => kind === 'task' || kind === 'completed' || kind === 'conflict' || kind === 'appointment';
