/**
 * MOCK STORE — the local "database" used while no backend is connected.
 *
 * One workspace per browser, persisted in localStorage so a family's data
 * survives refreshes. A new account starts completely empty; the optional
 * sample family can be loaded for demos. With the backend connected
 * (`VITE_USE_MOCKS=false`) the services call `apiRequest` and never touch
 * this file.
 */
import { config } from './config';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import { BUSY_HORIZON_MS, BUSY_LOOKBACK_MS, expandEvents } from '@/lib/recurrence';
import { buildSampleWorkspace } from '@/mocks/sampleWorkspace';
import type { EngineData } from './decision/engine';
import type {
  Account,
  Appointment,
  AuditEvent,
  Family,
  FamilyDocument,
  FamilyMember,
  GroceryItem,
  HealthProfile,
  Message,
  NotificationItem,
  PersonalEvent,
  ReassignmentRequest,
  Task,
  Unavailability,
} from '@/types/domain';

export interface Workspace {
  version: 3;
  isSample: boolean;
  /** Sample data is regenerated each day so its times stay current. */
  sampleSeededOn?: string;
  account: Account | null;
  family: Family | null;
  members: FamilyMember[];
  tasks: Task[];
  events: PersonalEvent[];
  appointments: Appointment[];
  unavailability: Unavailability[];
  reassignments: ReassignmentRequest[];
  notifications: NotificationItem[];
  audit: AuditEvent[];
  documents: FamilyDocument[];
  health: HealthProfile[];
  groceries: GroceryItem[];
  messages: Message[];
  /** When the signed-in person last opened each chat channel. */
  chatReadAt: Record<string, string>;
  /** Tasks and appointments a reminder was already raised for. */
  reminded: string[];
}

const STORE_KEY = 'hearth.workspace.v3';

export function emptyWorkspace(): Workspace {
  return {
    version: 3,
    isSample: false,
    account: null,
    family: null,
    members: [],
    tasks: [],
    events: [],
    appointments: [],
    unavailability: [],
    reassignments: [],
    notifications: [],
    audit: [],
    documents: [],
    health: [],
    groceries: [],
    messages: [],
    chatReadAt: {},
    reminded: [],
  };
}

function load(): Workspace {
  const stored = readJSON<Workspace | null>(STORE_KEY, null);
  if (!stored || stored.version !== 3) return emptyWorkspace();
  if (stored.isSample && stored.sampleSeededOn !== new Date().toDateString()) return buildSampleWorkspace();
  return { ...emptyWorkspace(), ...stored };
}

/** The live workspace. Services mutate it and call `persist()`. */
export const db: Workspace = load();

export function persist(): void {
  writeJSON(STORE_KEY, db);
}

export function replaceWorkspace(next: Workspace): void {
  Object.assign(db, next);
  persist();
}

export function clearWorkspace(): void {
  removeKey(STORE_KEY);
  Object.assign(db, emptyWorkspace());
}

/* ───────────────────────── helpers ───────────────────────── */

/** Resolve after the configured latency with a detached copy (like a network response). */
export function respond<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value === undefined ? value : structuredClone(value)), config.mockLatencyMs);
  });
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function fail(message: string, status = 400): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new ServiceError(message, status)), config.mockLatencyMs);
  });
}

export const notFound = (what: string) => fail(`${what} could not be found. It may have been removed.`, 404);

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const nowIso = () => new Date().toISOString();

export function requireFamily(): Family {
  if (!db.family) throw new ServiceError('Set up your family space first.', 409);
  return db.family;
}

export const actorId = () => db.account?.memberId ?? 'unknown';

export const me = () => db.members.find((m) => m.id === actorId());

export const isLead = () => me()?.role === 'lead';

/** Name of a member or dependant. */
export function personName(id: string | null | undefined): string {
  if (!id) return 'Unassigned';
  return db.members.find((m) => m.id === id)?.name ?? db.family?.dependants.find((d) => d.id === id)?.name ?? 'Someone';
}

export const memberName = (id: string | null | undefined) => (id && db.members.find((m) => m.id === id)?.name) || 'Unassigned';

export const firstName = (id: string | null | undefined) => memberName(id).split(' ')[0];

export const isDependant = (id: string | null | undefined) => Boolean(id && db.family?.dependants.some((d) => d.id === id));

/* ───────────────────────── privacy ───────────────────────── */

/** A private task belongs to the person doing it (and whoever wrote it down). */
export const canSeeTask = (t: Task, viewer = actorId()) => t.visibility === 'family' || t.assigneeId === viewer || t.createdById === viewer;

export const canSeeAppointment = (a: Appointment, viewer = actorId()) => a.visibility === 'family' || a.forId === viewer || a.escortId === viewer || a.createdById === viewer;

/**
 * Whose health notes the viewer may open: their own always; a dependant's or a
 * member's shared profile only with "medical" access (the organiser always has it).
 */
export function canSeeHealth(personId: string, viewer = actorId()): boolean {
  if (personId === viewer) return true;
  const m = db.members.find((x) => x.id === viewer);
  const medical = m?.role === 'lead' || Boolean(m?.access.medical);
  if (!medical) return false;
  if (isDependant(personId)) return true;
  return Boolean(db.health.find((h) => h.personId === personId)?.shared);
}

/* ───────────────────────── engine input ───────────────────────── */

/** Everything the decision engine needs, seen through `viewerId`'s eyes. */
export function engineData(viewerId: string | undefined = actorId(), now: number = Date.now()): EngineData {
  return {
    tasks: db.tasks,
    appointments: db.appointments,
    members: db.members,
    unavailability: db.unavailability,
    busy: expandEvents(db.events, now - BUSY_LOOKBACK_MS, now + BUSY_HORIZON_MS),
    calendarOwners: Array.from(new Set(db.events.map((e) => e.memberId))),
    viewerId,
  };
}

/* ───────────────────────── side records ───────────────────────── */

export function audit(event: Omit<AuditEvent, 'id' | 'at' | 'actorId'>): void {
  db.audit.unshift({ ...event, id: newId('e'), at: nowIso(), actorId: actorId() });
}

export function notify(item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): void {
  db.notifications.unshift({ ...item, id: newId('n'), createdAt: nowIso(), read: false });
}

/** A line Hearth adds to the family chat itself, e.g. when a task changes hands. */
export function postSystemMessage(text: string, channel: Message['channel'] = 'family'): void {
  db.messages.push({ id: newId('msg'), channel, authorId: null, kind: 'system', text, createdAt: nowIso() });
}
