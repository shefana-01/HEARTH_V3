/**
 * CareGraph — relationship view of the family's care data.
 *
 * In the target architecture this is a Neo4j-backed read model owned by
 * care-service. MOCK: the graph is derived from the local records.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { db, firstName, respond } from '../mockStore';
import { detectConflicts } from '../decision/engine';
import { formatDayTime, formatRelativeDay, formatTime } from '@/lib/dates';
import type { CareGraph, GraphEdge, GraphNode } from '@/types/domain';

/** Place `count` items evenly on an ellipse around the centre (percent units). */
function ring(count: number, rx: number, ry: number, offset = -90) {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((offset + (360 / Math.max(count, 1)) * i) * Math.PI) / 180;
    return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
  });
}

export const careGraphService = {
  async getGraph(): Promise<CareGraph> {
    if (!config.useMocks) return backendNotConnected('care-service', 'getCareGraph');
    const family = db.family;
    if (!family) return respond({ nodes: [], edges: [] });

    const now = Date.now();
    const flagged = new Set(
      detectConflicts({ tasks: db.tasks, appointments: db.appointments, members: db.members, unavailability: db.unavailability }).map((c) => c.taskId),
    );
    const tasks = db.tasks
      .filter((t) => t.status === 'scheduled' && new Date(t.start).getTime() > now - 3_600_000)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 5);
    const appointments = db.appointments.filter((a) => new Date(a.start).getTime() > now - 3_600_000).slice(0, 2);
    const goals = db.nutrition?.goals.slice(0, 2) ?? [];

    const inner = [
      ...goals.map((g) => ({ id: `goal:${g.id}`, kind: 'goal' as const, label: g.title, sublabel: g.target, href: '/nutrition' })),
      ...appointments.map((a) => ({ id: `appt:${a.id}`, kind: 'appointment' as const, label: a.title, sublabel: formatDayTime(a.start), href: `/appointments/${a.id}` })),
      ...tasks.map((t) => ({
        id: `task:${t.id}`,
        kind: 'task' as const,
        label: t.title,
        sublabel: `${formatRelativeDay(t.start)}, ${formatTime(t.start)}`,
        href: `/tasks/${t.id}`,
        flagged: flagged.has(t.id),
      })),
    ];
    const involvedMembers = db.members.filter(
      (m) => m.status === 'active' && (tasks.some((t) => t.assigneeId === m.id) || appointments.some((a) => a.escortId === m.id)),
    );

    const innerPos = ring(inner.length, 25, 28);
    const outerPos = ring(involvedMembers.length, 38, 42, -60);

    const nodes: GraphNode[] = [
      { id: 'recipient', kind: 'recipient', label: family.recipient.name, sublabel: family.recipient.relation || 'Care recipient', x: 50, y: 50 },
      ...inner.map((n, i) => ({ ...n, ...innerPos[i] })),
      ...involvedMembers.map((m, i) => ({
        id: `member:${m.id}`,
        kind: 'member' as const,
        label: m.name,
        sublabel: m.relation || (m.role === 'lead' ? 'Lead caregiver' : 'Caregiver'),
        href: `/family/${m.id}`,
        ...outerPos[i],
      })),
    ];

    const edges: GraphEdge[] = [
      ...goals.map((g) => ({ from: 'recipient', to: `goal:${g.id}`, label: 'has goal' })),
      ...appointments.map((a) => ({ from: 'recipient', to: `appt:${a.id}`, label: 'attends' })),
      ...tasks.map((t) => ({ from: 'recipient', to: `task:${t.id}`, label: 'receives care' })),
      ...tasks.filter((t) => t.assigneeId).map((t) => ({ from: `task:${t.id}`, to: `member:${t.assigneeId}`, label: `assigned to ${firstName(t.assigneeId)}` })),
      ...tasks.filter((t) => t.appointmentId && appointments.some((a) => a.id === t.appointmentId)).map((t) => ({ from: `appt:${t.appointmentId}`, to: `task:${t.id}`, label: 'depends on' })),
      ...tasks
        .filter((t) => t.category === 'meals' || t.category === 'errands')
        .flatMap((t) => goals.map((g) => ({ from: `goal:${g.id}`, to: `task:${t.id}`, label: 'supported by' }))),
      ...appointments.filter((a) => a.escortId && !tasks.some((t) => t.appointmentId === a.id)).map((a) => ({ from: `appt:${a.id}`, to: `member:${a.escortId}`, label: `escorted by ${firstName(a.escortId)}` })),
    ].filter((e) => nodes.some((n) => n.id === e.to) && nodes.some((n) => n.id === e.from));

    return respond({ nodes, edges });
  },
};
