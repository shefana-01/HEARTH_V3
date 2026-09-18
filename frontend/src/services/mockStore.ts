/**
 * MOCK STORE — the local "database" used while no backend exists.
 *
 * One workspace per browser, persisted in localStorage so a family's data
 * survives refreshes. A new account starts completely empty; the optional
 * sample family can be loaded for demos. When the backend is connected this
 * file and `src/mocks` are deleted and the services call `apiRequest` instead.
 */
import { config } from './config';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import { buildSampleWorkspace } from '@/mocks/sampleWorkspace';
import type { Account, Appointment, AuditEvent, CareDocument, CareTask, Family, FamilyMember, GroceryItem, NotificationItem, NutritionPlan, ReassignmentRequest, Unavailability } from '@/types/domain';

export interface Workspace {
  version: 2;
  isSample: boolean;
  /** Sample data is regenerated each day so its times stay current. */
  sampleSeededOn?: string;
  account: Account | null;
  family: Family | null;
  members: FamilyMember[];
  tasks: CareTask[];
  appointments: Appointment[];
  unavailability: Unavailability[];
  reassignments: ReassignmentRequest[];
  notifications: NotificationItem[];
  audit: AuditEvent[];
  documents: CareDocument[];
  nutrition: NutritionPlan | null;
  groceries: GroceryItem[];
}

const STORE_KEY = 'hearth.workspace.v2';

export function emptyWorkspace(): Workspace {
  return {
    version: 2,
    isSample: false,
    account: null,
    family: null,
    members: [],
    tasks: [],
    appointments: [],
    unavailability: [],
    reassignments: [],
    notifications: [],
    audit: [],
    documents: [],
    nutrition: null,
    groceries: [],
  };
}

function load(): Workspace {
  const stored = readJSON<Workspace | null>(STORE_KEY, null);
  if (!stored || stored.version !== 2) return emptyWorkspace();
  if (stored.isSample && stored.sampleSeededOn !== new Date().toDateString()) return buildSampleWorkspace();
  return stored;
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
  if (!db.family) throw new ServiceError('Set up your family first.', 409);
  return db.family;
}

export const actorId = () => db.account?.memberId ?? 'unknown';

export const memberName = (id: string | null | undefined) => (id && db.members.find((m) => m.id === id)?.name) || 'Unassigned';

export const firstName = (id: string | null | undefined) => memberName(id).split(' ')[0];

export function audit(event: Omit<AuditEvent, 'id' | 'at' | 'actorId'>): void {
  db.audit.unshift({ ...event, id: newId('e'), at: nowIso(), actorId: actorId() });
}

export function notify(item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): void {
  db.notifications.unshift({ ...item, id: newId('n'), createdAt: nowIso(), read: false });
}
