import { CalendarClock, CircleCheckBig, Heart, House, UserRound, type LucideIcon } from 'lucide-react';
import type { GraphEdge, GraphNode, GraphNodeKind } from '@/types/domain';

export const NODE_META: Record<GraphNodeKind, { label: string; plural: string; icon: LucideIcon; chip: string; ring: string; open: string }> = {
  family: { label: 'Family', plural: 'Family', icon: House, chip: 'bg-primary-100 text-primary-800', ring: 'border-primary-300', open: 'Open the family hub' },
  member: { label: 'Member', plural: 'Members', icon: UserRound, chip: 'bg-mint-100 text-mint-800', ring: 'border-mint-200', open: 'Open their page' },
  dependant: { label: 'We look after', plural: 'People we look after', icon: Heart, chip: 'bg-rose-100 text-rose-700', ring: 'border-rose-300', open: 'Open their health notes' },
  appointment: { label: 'Appointment', plural: 'Appointments', icon: CalendarClock, chip: 'bg-amber-100 text-amber-700', ring: 'border-amber-200', open: 'Open the appointment' },
  task: { label: 'Task', plural: 'Tasks', icon: CircleCheckBig, chip: 'bg-surface-sunken text-ink-muted', ring: 'border-line-strong', open: 'Open the task' },
};

/** The family, and the people in it: always on the map. Tasks and appointments can be filtered. */
export const isCore = (node: GraphNode) => node.kind === 'family' || node.kind === 'member' || node.kind === 'dependant';

/** Lines from the family to its people only show who belongs; they are drawn quietly. */
export const isStructural = (edge: GraphEdge) => edge.from === 'family';

export const encodeNodeId = (id: string) => encodeURIComponent(id);

const FROM_THIS: Record<string, string> = { does: 'Does', 'needed for': 'Needed for', 'goes along': 'Goes along to', member: 'Member', 'looked after': 'Looked after' };
const TO_THIS: Record<string, string> = { does: 'Done by', 'needed for': 'Needed for this', 'goes along': 'Going along', member: 'Member of', 'looked after': 'Looked after by' };

/** How an edge reads from one end: "Does", "Done by", "For Amina". */
export function connectionLabel(edge: GraphEdge, nodeId: string): string {
  const known = (edge.from === nodeId ? FROM_THIS : TO_THIS)[edge.label];
  return known ?? edge.label.charAt(0).toUpperCase() + edge.label.slice(1);
}
