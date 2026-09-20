/**
 * Hearth domain model (frontend view).
 *
 * Hearth is built around a person, not a patient: everyone has their own
 * schedule, tasks and health notes, and shares the parts that matter with
 * their family. Nothing here assumes particular people, roles or conditions.
 * These interfaces are the contract the backend services satisfy — see
 * `src/services/README.md`.
 */

export type ID = string;
/** ISO-8601 date-time string. */
export type ISODateTime = string;

export type Tone = 'neutral' | 'primary' | 'rose' | 'mint' | 'amber' | 'red';

/* ───────────────────────────── Family ───────────────────────────── */

/** `lead` organises the family space, `contributor` takes part, `observer` only follows along. */
export type MemberRole = 'lead' | 'contributor' | 'observer';
export type MemberStatus = 'active' | 'invited';

/** Kinds of help a member can give. Used by the suitability score. */
export type Skill = 'driving' | 'medication' | 'errands' | 'meals' | 'household' | 'childcare' | 'mobility' | 'companionship' | 'clinical';

/** A daily time window, "HH:mm" local time. */
export interface TimeWindow {
  id: ID;
  label: string;
  start: string;
  end: string;
}

export interface WeeklyAvailability {
  /** Monday → Sunday. */
  days: boolean[];
  windows: TimeWindow[];
}

/** A short "what I'm up to" line the family can see, e.g. "In class until 2". */
export interface StatusNote {
  text: string;
  /** When it stops being true. Absent = until changed. */
  until?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FamilyMember {
  id: ID;
  name: string;
  relation: string;
  role: MemberRole;
  /** Free-text: what this person usually handles, e.g. "Groceries & weekend drives". */
  focus: string;
  email: string;
  phone?: string;
  /** Small profile picture as a data URL (mock) — becomes an uploaded file URL with the backend. */
  photo?: string;
  status: MemberStatus;
  skills: Skill[];
  availability: WeeklyAvailability;
  /** Shared-data scopes this member can see. */
  access: { schedule: boolean; medical: boolean; documents: boolean };
  statusNote?: StatusNote;
  joinedAt: ISODateTime;
}

/**
 * Someone the family looks after who does not use Hearth themselves:
 * a child, an elderly parent, a relative who is unwell. A family can have
 * none, one or several.
 */
export interface Dependant {
  id: ID;
  name: string;
  /** Relationship to the family, e.g. "Mother", "Grandfather", "Son". */
  relation: string;
  birthYear?: number;
  notes: string;
}

export type DependantInput = Omit<Dependant, 'id'>;

/** Anyone a task, appointment, document or health note can be about. */
export interface Person {
  id: ID;
  kind: 'member' | 'dependant';
  name: string;
  relation: string;
}

export interface Family {
  id: ID;
  name: string;
  location: string;
  /** IANA time zone of the family, e.g. "Asia/Dhaka". Set by the API; absent in mock data. */
  timezone?: string;
  createdAt: ISODateTime;
  dependants: Dependant[];
  /** The most the family wants to spend on groceries in a week, in the app currency. */
  weeklyGroceryBudget?: number;
  inviteCode: string;
}

export interface Account {
  id: ID;
  memberId: ID;
  name: string;
  email: string;
  phone?: string;
  about: string;
  photo?: string;
  /** `false` until the person opens the confirmation link we emailed. Absent in the offline demo (no email there). */
  emailVerified?: boolean;
  /** Preference only. Sending WhatsApp messages needs the notification service. */
  whatsappAlerts?: boolean;
}

/* ─────────────────────── Personal schedule ─────────────────────── */

export type EventKind = 'class' | 'work' | 'personal' | 'travel' | 'other';

/**
 * Something on one person's own calendar: a class, a work shift, a gym
 * session. Hearth treats it as time that person is busy, so tasks are not
 * planned on top of it.
 */
export interface PersonalEvent {
  id: ID;
  memberId: ID;
  title: string;
  kind: EventKind;
  /** First (or only) occurrence. For weekly events this also gives the time of day. */
  start: ISODateTime;
  durationMin: number;
  repeat: 'none' | 'weekly';
  /** Weekly only: which days it happens on, Monday → Sunday. */
  days: boolean[];
  /** Weekly only: last day it happens (inclusive). Absent = no end. */
  until?: ISODateTime;
  location: string;
  /** `busy` hides the title from the rest of the family — they only see that the time is taken. */
  visibility: 'details' | 'busy';
  createdAt: ISODateTime;
}

export type PersonalEventInput = Omit<PersonalEvent, 'id' | 'memberId' | 'createdAt'>;

/** One concrete block of busy time, produced by expanding personal events. */
export interface BusyBlock {
  id: ID;
  eventId: ID;
  memberId: ID;
  label: string;
  /** The owner chose to show the family only that they are busy, not why. */
  hidden: boolean;
  start: ISODateTime;
  end: ISODateTime;
}

/* ───────────────────────────── Tasks ───────────────────────────── */

export type TaskPriority = 'routine' | 'important' | 'urgent';
export type TaskStatus = 'scheduled' | 'completed' | 'cancelled';
export type TaskCategory = 'medication' | 'health' | 'meals' | 'errands' | 'household' | 'childcare' | 'transport' | 'study' | 'work' | 'exercise' | 'family' | 'other';

/**
 * `family` tasks are shared: everyone sees them and they can be handed over.
 * `private` tasks are personal to-dos: only their owner sees the details and
 * they are never offered to someone else. The family just sees "Busy".
 */
export type Visibility = 'family' | 'private';

export interface Task {
  id: ID;
  title: string;
  notes: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  start: ISODateTime;
  durationMin: number;
  assigneeId: ID | null;
  /** Who the task is for (a member or a dependant), if anyone in particular. */
  forId?: ID;
  visibility: Visibility;
  createdById: ID;
  createdAt: ISODateTime;
  appointmentId?: ID;
  completedAt?: ISODateTime;
  completedById?: ID;
  reminder: boolean;
  /** The owner chose to keep the plan despite this detected conflict kind. */
  acknowledgedConflict?: Conflict['kind'];
}

export interface TaskInput {
  title: string;
  notes: string;
  category: TaskCategory;
  priority: TaskPriority;
  start: ISODateTime;
  durationMin: number;
  assigneeId: ID | null;
  forId?: ID;
  visibility: Visibility;
  appointmentId?: ID;
  reminder: boolean;
}

/* ─────────────────────── Unavailability ─────────────────────── */

export interface Unavailability {
  id: ID;
  memberId: ID;
  start: ISODateTime;
  end: ISODateTime;
  reason: string;
  note: string;
  createdAt: ISODateTime;
}

/* ───────────────────── Decision engine (derived) ───────────────────── */

/** Why a task cannot go ahead as planned. Produced by the decision engine. */
export interface Conflict {
  id: ID;
  taskId: ID;
  memberId: ID | null;
  kind: 'unassigned' | 'overlap' | 'outside-availability' | 'reported-unavailable';
  /** Plain-language explanation. */
  reason: string;
  overlapMinutes: number;
  /** The other commitment involved, if any. */
  otherLabel?: string;
}

/**
 * Task Priority Score (0–100):
 *   P = wD·D + wC·C + wI·I + wR·R + wS·S
 * D deadline urgency · C criticality · I dependency impact ·
 * R reassignment difficulty · S schedule-conflict severity.
 */
export interface PriorityBreakdown {
  score: number;
  factors: { deadline: number; criticality: number; dependency: number; reassignment: number; conflict: number };
  explanation: string;
}

/**
 * Candidate Suitability Score (0–100):
 *   Score = w1·Availability + w2·WorkloadCapacity + w3·SkillEligibility − w4·ConflictCost
 */
export interface CandidateScore {
  memberId: ID;
  score: number;
  factors: { availability: number; workloadCapacity: number; skillEligibility: number; conflictCost: number };
  tasksThatDay: number;
  overlapMinutes: number;
  reasons: string[];
  cautions: string[];
}

/** Where a task falls in someone's day: do it now, do it next, or it can safely wait. */
export type Advice = 'now' | 'next' | 'later';

/** One task in a person's ranked list ("what should I do first?"). */
export interface RankedTask {
  task: Task;
  /** 1 = do this first. */
  rank: number;
  priority: PriorityBreakdown;
  conflict?: Conflict;
  advice: Advice;
  /** Set when this task scored the same as the one after it: says what decided the order. */
  tieBreak?: string;
  /** Minutes until the task starts (negative = overdue). */
  startsInMin: number;
}

export type ReassignmentStatus = 'open' | 'approved' | 'cancelled';

/** A request to hand a task over to someone else. */
export interface ReassignmentRequest {
  id: ID;
  taskId: ID;
  fromMemberId: ID | null;
  reason: string;
  note: string;
  createdAt: ISODateTime;
  createdById: ID;
  status: ReassignmentStatus;
  approvedMemberId?: ID;
  resolvedAt?: ISODateTime;
}

export interface SimulationChange {
  taskId: ID;
  assigneeId?: ID | null;
  start?: ISODateTime;
}

export interface SimulationResult {
  change: SimulationChange;
  conflictsBefore: Conflict[];
  conflictsAfter: Conflict[];
  resolved: Conflict[];
  introduced: Conflict[];
  /** Minutes of assigned work that day, per member, before/after. */
  workload: { memberId: ID; before: number; after: number }[];
}

/* ───────────────────────────── Appointments ───────────────────────────── */

export interface PrepItem {
  id: ID;
  label: string;
  done: boolean;
  doneById?: ID;
}

export interface Appointment {
  id: ID;
  title: string;
  specialty: string;
  start: ISODateTime;
  durationMin: number;
  provider: string;
  location: string;
  /** Who the appointment is for: a member or a dependant. */
  forId: ID;
  /** A member going along, if anyone. */
  escortId: ID | null;
  visibility: Visibility;
  prep: PrepItem[];
  note: string;
  createdById: ID;
  createdAt: ISODateTime;
}

export type AppointmentInput = Omit<Appointment, 'id' | 'prep' | 'createdAt' | 'createdById'> & { prep: string[] };

/* ───────────────────────── Health & food ───────────────────────── */

export type NutritionTag = 'iron' | 'vitamin-c' | 'calcium' | 'magnesium' | 'omega-3' | 'low-sodium' | 'heart' | 'low-glycemic' | 'high-fibre' | 'high-protein' | 'soft-texture' | 'hydration';

/**
 * Something a person told Hearth about their health ("low iron", "period
 * pain"). Hearth never works these out by itself, and it only uses them to
 * suggest everyday foods — see `constants/conditions.ts`.
 */
export interface HealthCondition {
  id: ID;
  label: string;
  /** One plain sentence on what this means for food. */
  summary: string;
  tags: NutritionTag[];
}

export interface HealthGoal {
  id: ID;
  title: string;
  target: string;
  tags: NutritionTag[];
}

/** One person's health notes. Each member owns theirs; dependants' are kept by the family. */
export interface HealthProfile {
  personId: ID;
  /** Ids from the conditions catalogue. */
  conditions: ID[];
  /** Extra goals in the person's own words, e.g. from a doctor or dietitian. */
  goals: HealthGoal[];
  /** Foods to leave out of suggestions. */
  avoid: string[];
  /** Foods the person likes. */
  preferences: string[];
  notes: string;
  /** Members only: let family members with "medical" access see this profile. Dependants' profiles are always shared with them. */
  shared: boolean;
  updatedAt: ISODateTime;
}

export type HealthProfileInput = Omit<HealthProfile, 'personId' | 'updatedAt'>;

/** A food option from the reference dataset (not medical advice). */
export interface FoodOption {
  id: ID;
  name: string;
  /** Name people use locally, if different. */
  localName?: string;
  group: string;
  tags: NutritionTag[];
  description: string;
  portion: string;
  estimatedPrice: number;
  alternatives: string[];
}

/** Why a food is suggested: whose need it matches and which one. */
export interface SuggestionReason {
  personId: ID;
  /** A condition label or a goal title. */
  because: string;
  tags: NutritionTag[];
}

export interface FoodSuggestion extends FoodOption {
  reasons: SuggestionReason[];
  onList: boolean;
}

export interface GroceryItem {
  id: ID;
  name: string;
  group: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  status: 'needed' | 'in-pantry';
  foodId?: ID;
  /** People this was added for. */
  forIds: ID[];
  /** Short reason shown on the list, e.g. "Iron". */
  reason?: string;
  addedById?: ID;
}

/* ─────────────────────── Documents ─────────────────────── */

export type DocumentCategory = 'Medical report' | 'Prescription' | 'Lab result' | 'Insurance' | 'ID & legal' | 'School & work' | 'Bills & receipts' | 'Other';
/** `family` = everyone with document access; `restricted` = only the people listed. */
export type DocumentAccess = 'family' | 'restricted';

export interface FamilyDocument {
  id: ID;
  title: string;
  category: DocumentCategory;
  fileName: string;
  sizeKB: number;
  uploadedAt: ISODateTime;
  uploadedById: ID;
  /** Who the document is about (a member or dependant). Absent = the household. */
  ownerId?: ID;
  access: DocumentAccess;
  /** Member IDs allowed to open a restricted document. */
  allowedIds: ID[];
  appointmentId?: ID;
}

/* ───────────────────────── Messages ───────────────────────── */

/** `family` is the family group chat; `task:<id>` is the comment thread of one task. */
export type Channel = 'family' | `task:${string}`;

export interface Message {
  id: ID;
  channel: Channel;
  /** `null` for messages Hearth posts itself. */
  authorId: ID | null;
  /** `status` = someone updated their status line; `system` = Hearth noting a change. */
  kind: 'text' | 'status' | 'system';
  text: string;
  createdAt: ISODateTime;
}

/* ─────────────────────── Notifications & audit ─────────────────────── */

export type NotificationType = 'task' | 'reassignment' | 'conflict' | 'availability' | 'appointment' | 'nutrition' | 'circle' | 'reminder';

export interface NotificationItem {
  id: ID;
  type: NotificationType;
  message: string;
  createdAt: ISODateTime;
  read: boolean;
  href?: string;
  /** Only this member sees it. Absent = the whole family. */
  forId?: ID;
}

export type AuditCategory = 'tasks' | 'schedule' | 'care' | 'circle';

export interface AuditEvent {
  id: ID;
  actorId: ID;
  category: AuditCategory;
  action: string;
  subject: string;
  at: ISODateTime;
  before?: string;
  after?: string;
}

/* ─────────────────────── Schedule view ─────────────────────── */

export interface ScheduleEvent {
  id: ID;
  /** `event` is a personal event; `busy` is someone else's private time. */
  kind: 'task' | 'completed' | 'conflict' | 'appointment' | 'unavailable' | 'event' | 'busy';
  title: string;
  subtitle?: string;
  start: ISODateTime;
  end: ISODateTime;
  memberId: ID | null;
  /** A second member involved, e.g. whoever is going along to an appointment. */
  alsoMemberId?: ID;
  href?: string;
}

/* ─────────────────────── Family map (CareGraph) ─────────────────────── */

export type GraphNodeKind = 'family' | 'member' | 'dependant' | 'appointment' | 'task';

export interface GraphNode {
  id: ID;
  kind: GraphNodeKind;
  label: string;
  sublabel: string;
  /** Route of the underlying record. */
  href?: string;
  /** Layout position, percent of the canvas. */
  x: number;
  y: number;
  flagged?: boolean;
}

export interface GraphEdge {
  from: ID;
  to: ID;
  label: string;
}

export interface CareGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
