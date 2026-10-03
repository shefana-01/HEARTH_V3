/**
 * Family map — who is doing what for whom, as a small graph.
 *
 * With the API, the graph comes from care-service, which keeps it in Neo4j and
 * answers with Cypher queries. Which tasks are in conflict "right now" is not
 * part of the stored graph, so that comes from decision-service. This file
 * only adds what is presentation: date wording and where each node sits.
 *
 * MOCK: the same graph is derived from the local records.
 * Private tasks and appointments are never part of the map.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { decisionService } from '../decision/decisionService';
import { detectConflicts } from '../decision/engine';
import { db, engineData, respond } from '../mockStore';
import { ROLES } from '@/constants/labels';
import { formatDayTime, formatRelativeDay, formatTime } from '@/lib/dates';
import type { Appointment, CareGraph, Family, FamilyMember, GraphEdge, GraphNode, Task } from '@/types/domain';

/** Place `count` items evenly on an ellipse around the centre (percent units). */
function ring(count: number, rx: number, ry: number, offset = -90) {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((offset + (360 / Math.max(count, 1)) * i) * Math.PI) / 180;
    return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
  });
}

/** A node as care-service returns it: the facts, without wording or layout. */
interface ApiNode {
  id: string;
  kind: GraphNode['kind'];
  label: string;
  /** Relationship (member, dependant). */
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

interface GraphInput {
  family: Family | null;
  tasks: Task[];
  appointments: Appointment[];
  members: FamilyMember[];
}

const MAX_TASKS = 6;
const MAX_APPOINTMENTS = 3;

/** Pure: the same records always give the same graph (before wording and layout). */
function buildGraph(input: GraphInput, now: number): ApiGraph {
  const { family, members } = input;
  if (!family) return { nodes: [], edges: [] };
  const first = (name: string) => name.split(' ')[0];
  const memberById = new Map(members.map((m) => [m.id, m]));
  const dependantById = new Map(family.dependants.map((d) => [d.id, d]));
  const personNode = (id: string | null | undefined) => (id && memberById.has(id) ? `member:${id}` : id && dependantById.has(id) ? `dependant:${id}` : null);
  const nameOf = (id: string) => memberById.get(id)?.name ?? dependantById.get(id)?.name ?? '';

  const tasks = input.tasks
    .filter((t) => t.visibility === 'family' && t.status === 'scheduled' && new Date(t.start).getTime() > now - 3_600_000)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .slice(0, MAX_TASKS);
  const appointments = input.appointments
    .filter((a) => a.visibility === 'family' && new Date(a.start).getTime() > now - 3_600_000)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .slice(0, MAX_APPOINTMENTS);

  const edges: GraphEdge[] = [];
  const link = (from: string | null, to: string | null, label: string) => {
    if (from && to) edges.push({ from, to, label });
  };
  for (const t of tasks) {
    link(personNode(t.assigneeId), `task:${t.id}`, 'does');
    if (t.forId && t.forId !== t.assigneeId) link(`task:${t.id}`, personNode(t.forId), `for ${first(nameOf(t.forId))}`);
    if (t.appointmentId && appointments.some((a) => a.id === t.appointmentId)) link(`task:${t.id}`, `appt:${t.appointmentId}`, 'needed for');
  }
  for (const a of appointments) {
    link(`appt:${a.id}`, personNode(a.forId), `for ${first(nameOf(a.forId))}`);
    if (a.escortId && a.escortId !== a.forId) link(personNode(a.escortId), `appt:${a.id}`, 'goes along');
  }

  // Everyone active is on the map, so the family sees who is free as well as who is busy.
  const people: ApiNode[] = [
    ...members.filter((m) => m.status === 'active').map((m) => ({ id: `member:${m.id}`, kind: 'member' as const, label: m.name, detail: m.relation, role: m.role, href: `/family/${m.id}` })),
    ...family.dependants.map((d) => ({ id: `dependant:${d.id}`, kind: 'dependant' as const, label: d.name, detail: d.relation, href: `/health/${d.id}` })),
  ];
  for (const p of people) edges.push({ from: 'family', to: p.id, label: p.kind === 'member' ? 'member' : 'looked after' });

  return {
    nodes: [
      { id: 'family', kind: 'family', label: family.name, detail: family.location },
      ...people,
      ...appointments.map((a) => ({ id: `appt:${a.id}`, kind: 'appointment' as const, label: a.title, start: a.start, href: `/appointments/${a.id}` })),
      ...tasks.map((t) => ({ id: `task:${t.id}`, kind: 'task' as const, label: t.title, start: t.start, href: `/tasks/${t.id}` })),
    ],
    edges,
  };
}

function sublabel(node: ApiNode): string {
  switch (node.kind) {
    case 'family':
      return node.detail || 'Your family';
    case 'member':
      return node.detail || ROLES[node.role as keyof typeof ROLES]?.label || 'Member';
    case 'dependant':
      return node.detail || 'Looked after by the family';
    case 'appointment':
      return node.start ? formatDayTime(node.start) : '';
    case 'task':
      return node.start ? `${formatRelativeDay(node.start)}, ${formatTime(node.start)}` : '';
  }
}

/** The family in the centre, its people on the inner ring, what they are doing on the outer ring. */
function layout(graph: ApiGraph, flagged: Set<string>): CareGraph {
  const people = graph.nodes.filter((n) => n.kind === 'member' || n.kind === 'dependant');
  const items = graph.nodes.filter((n) => n.kind === 'appointment' || n.kind === 'task');
  const innerPos = ring(people.length, 21, 23, -90);
  const outerPos = ring(items.length, 40, 43, -70);
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
    ...graph.nodes.filter((n) => n.kind === 'family').map((n) => place(n, { x: 50, y: 50 })),
    ...people.map((n, i) => place(n, innerPos[i])),
    ...items.map((n, i) => place(n, outerPos[i])),
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
    const now = Date.now();
    const flagged = new Set(detectConflicts(engineData(undefined, now), now).map((c) => c.taskId));
    return respond(layout(buildGraph({ family: db.family, tasks: db.tasks, appointments: db.appointments, members: db.members }, now), flagged));
  },
};
