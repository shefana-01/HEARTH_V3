import { CalendarClock, HeartHandshake, Target, UserRound, Heart, type LucideIcon } from 'lucide-react';
import type { GraphNodeKind } from '@/types/domain';

export const NODE_META: Record<GraphNodeKind, { label: string; plural: string; icon: LucideIcon; chip: string; ring: string }> = {
  recipient: { label: 'Care recipient', plural: 'Care recipient', icon: Heart, chip: 'bg-rose-100 text-rose-700', ring: 'border-rose-300' },
  goal: { label: 'Care goal', plural: 'Goals', icon: Target, chip: 'bg-mint-100 text-mint-800', ring: 'border-mint-200' },
  appointment: { label: 'Appointment', plural: 'Appointments', icon: CalendarClock, chip: 'bg-primary-100 text-primary-800', ring: 'border-primary-200' },
  task: { label: 'Care task', plural: 'Tasks', icon: HeartHandshake, chip: 'bg-amber-100 text-amber-700', ring: 'border-amber-200' },
  member: { label: 'Caregiver', plural: 'People', icon: UserRound, chip: 'bg-surface-sunken text-ink-muted', ring: 'border-line-strong' },
};

export const encodeNodeId = (id: string) => encodeURIComponent(id);
