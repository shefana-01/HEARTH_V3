/**
 * CareGraph — relationship view of the family's care data.
 *
 * With the API, the graph comes from care-service, which keeps it in Neo4j and
 * answers with Cypher queries. Which tasks are in conflict "right now" is not
 * part of the stored graph, so that comes from decision-service. This file
 * only adds what is presentation: date wording and where each node sits.
 *
 * MOCK: the same graph is derived from the local records.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { decisionService } from '../decision/decisionService';
import { detectConflicts } from '../decision/engine';
import { db, respond } from '../mockStore';
import { formatDayTime, formatRelativeDay, formatTime } from '@/lib/dates';
import type { Appointment, CareGraph, CareTask, Family, FamilyMember, GraphEdge, GraphNode, NutritionPlan } from '@/types/domain';

/** Place `count` items evenly on an ellipse around the centre (percent units). */
function ring(count: number, rx: number, ry: number, offset = -90) {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((offset + (360 / Math.max(count, 1)) * i) * Math.PI) / 180;
    return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
  });
}

interface GraphInput {
  family: Family | null;
  tasks: CareTask[];
  appointments: Appointment[];
  members: FamilyMember[];
  nutrition: NutritionPlan | null;
  /** Ids of tasks that currently have a conflict. */
  flagged: Set<string>;
}

/** Pure: the same records always give the same graph. */
function buildGraph(input: GraphInput): CareGraph {
  const { family, members, flagged } = input;
  if (!family) return { nodes: [], edges: [] };
  const firstName = (id: string | null | undefined) => (members.find((m) => m.id === id)?.name ?? 'Unassigned').split(' ')[0];

  const now = Date.now();
  const tasks = input.tasks
    .filter((t) => t.status === 'scheduled' && new Date(t.start).getTime() > now - 3_600_000)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);
  const appointments = input.appointments.filter((a) => new Date(a.start).getTime() > now - 3_600_000).slice(0, 2);
  const goals = input.nutrition?.goals.slice(0, 2) ?? [];

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
  const involvedMembers = members.filter((m) => m.status === 'active' && (tasks.some((t) => t.assigneeId === m.id) || appointments.some((a) => a.escortId === m.id)));

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
    ...tasks.filter((t) => t.category === 'meals' || t.category === 'errands').flatMap((t) => goals.map((g) => ({ from: `goal:${g.id}`, to: `task:${t.id}`, label: 'supported by' }))),
    ...appointments
      .filter((a) => a.escortId && !tasks.some((t) => t.appointmentId === a.id))
      .map((a) => ({ from: `appt:${a.id}`, to: `member:${a.escortId}`, label: `escorted by ${firstName(a.escortId)}` })),
  ].filter((e) => nodes.some((n) => n.id === e.to) && nodes.some((n) => n.id === e.from));

  return { nodes, edges };
}

/** A node as care-service returns it: the facts, without wording or layout. */
interface ApiNode {
  id: string;
  kind: GraphNode['kind'];
  label: string;
  /** Relationship (recipient, member) or target (goal). */
  detail?: string;
  /** When it happens (appointment, task). */
  start?: string;
  role?: string;
  href?: string;
}

interface ApiGraph {
  nodes: ApiNode[];
  edges: GraphEdge[];
}

function sublabel(node: ApiNode): string {
  switch (node.kind) {
    case 'recipient':
      return node.detail || 'Care recipient';
    case 'goal':
      return node.detail ?? '';
    case 'appointment':
      return node.start ? formatDayTime(node.start) : '';
    case 'task':
      return node.start ? `${formatRelativeDay(node.start)}, ${formatTime(node.start)}` : '';
    case 'member':
      return node.detail || (node.role === 'lead' ? 'Lead caregiver' : 'Caregiver');
  }
}

/** Same arrangement as the mock: recipient in the centre, care items on the inner ring, people on the outer ring. */
function layout(graph: ApiGraph, flagged: Set<string>): CareGraph {
  const inner = graph.nodes.filter((n) => n.kind === 'goal' || n.kind === 'appointment' || n.kind === 'task');
  const people = graph.nodes.filter((n) => n.kind === 'member');
  const innerPos = ring(inner.length, 25, 28);
  const outerPos = ring(people.length, 38, 42, -60);
  const place = (node: ApiNode, position: { x: number; y: number }): GraphNode => ({
    id: node.id,
    kind: node.kind,
    label: node.label,
    sublabel: sublabel(node),
    href: node.href,
    ...position,
    ...(node.kind === 'task' ? { flagged: flagged.has(node.id.replace(/^task:/, '')) } : {}),
  });
  const nodes = [
    ...graph.nodes.filter((n) => n.kind === 'recipient').map((n) => place(n, { x: 50, y: 50 })),
    ...inner.map((n, i) => place(n, innerPos[i])),
    ...people.map((n, i) => place(n, outerPos[i])),
  ];
  return { nodes, edges: graph.edges };
}

async function graphFromApi(): Promise<CareGraph> {
  const [graph, attention] = await Promise.all([apiRequest<ApiGraph>('/caregraph'), decisionService.listAttention()]);
  return layout(graph, new Set(attention.map((item) => item.task.id)));
}

export const careGraphService = {
  async getGraph(): Promise<CareGraph> {
    if (!config.useMocks) return graphFromApi();
    const flagged = new Set(detectConflicts({ tasks: db.tasks, appointments: db.appointments, members: db.members, unavailability: db.unavailability }).map((c) => c.taskId));
    return respond(buildGraph({ family: db.family, tasks: db.tasks, appointments: db.appointments, members: db.members, nutrition: db.nutrition, flagged }));
  },
};
