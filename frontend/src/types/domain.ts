/**
 * Hearth domain model (frontend view).
 *
 * Generic for any family: nothing here assumes particular people, roles or
 * conditions. These interfaces are the contract the backend services need to
 * satisfy (or be mapped into) — see `src/services/README.md`.
 */

export type ID = string;
/** ISO-8601 date-time string. */
export type ISODateTime = string;

export type Tone = 'neutral' | 'primary' | 'rose' | 'mint' | 'amber' | 'red';

/* ───────────────────────────── Family ───────────────────────────── */

export type MemberRole = 'lead' | 'contributor' | 'observer';
export type MemberStatus = 'active' | 'invited';

/** Kinds of help a member can give. Used by the suitability score. */
export type Skill = 'driving' | 'medication' | 'errands' | 'meals' | 'mobility' | 'companionship' | 'clinical';

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

export interface FamilyMember {
  id: ID;
  name: string;
  relation: string;
  role: MemberRole;
  /** Free-text household responsibility, e.g. "Errands & weekend drives". */
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
  joinedAt: ISODateTime;
}

export interface CareRecipient {
  id: ID;
  name: string;
  /** Relationship to the family, e.g. "Mother", "Grandfather", "Son". */
  relation: string;
  birthYear?: number;
  careNotes: string;
}

export interface Family {
  id: ID;
  name: string;
  location: string;
  careFocus: string;
  /** IANA time zone of the family, e.g. "Asia/Dhaka". Set by the API; absent in mock data. */
  timezone?: string;
  createdAt: ISODateTime;
  recipient: CareRecipient;
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

/* ───────────────────────────── Tasks ───────────────────────────── */

export type TaskPriority = 'routine' | 'important' | 'urgent';
export type TaskStatus = 'scheduled' | 'completed' | 'cancelled';
export type TaskCategory = 'medication' | 'vitals' | 'meals' | 'errands' | 'mobility' | 'transport' | 'companionship' | 'other';

export interface CareTask {
  id: ID;
  title: string;
  notes: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  start: ISODateTime;
  durationMin: number;
  assigneeId: ID | null;
  createdById: ID;
  createdAt: ISODateTime;
  appointmentId?: ID;
  completedAt?: ISODateTime;
  completedById?: ID;
  reminder: boolean;
  /** The lead chose to keep the plan despite this detected conflict kind. */
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
 * D deadline urgency · C care criticality · I dependency impact ·
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

export type ReassignmentStatus = 'open' | 'approved' | 'cancelled';

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
  escortId: ID | null;
  prep: PrepItem[];
  note: string;
  createdAt: ISODateTime;
}

export type AppointmentInput = Omit<Appointment, 'id' | 'prep' | 'createdAt'> & { prep: string[] };

/* ───────────────────────────── Nutrition ───────────────────────────── */

export type NutritionTag = 'low-sodium' | 'heart' | 'low-glycemic' | 'high-fibre' | 'high-protein' | 'soft-texture' | 'iron' | 'hydration';

export interface NutritionPlan {
  goals: { id: ID; title: string; target: string; tags: NutritionTag[] }[];
  preferences: string[];
  avoid: string[];
  preparationNote: string;
  weeklyBudget: { min: number; max: number };
  reviewedBy: string;
  updatedAt: ISODateTime;
}

/** A food option from the reference dataset (not medical advice). */
export interface FoodOption {
  id: ID;
  name: string;
  group: string;
  tags: NutritionTag[];
  description: string;
  portion: string;
  estimatedPrice: number;
  alternatives: string[];
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
}

/* ─────────────────────── Documents ─────────────────────── */

export type DocumentCategory = 'Clinical summary' | 'Prescription' | 'Care guideline' | 'Lab result' | 'Legal' | 'Other';
export type DocumentAccess = 'circle' | 'restricted';

export interface CareDocument {
  id: ID;
  title: string;
  category: DocumentCategory;
  fileName: string;
  sizeKB: number;
  uploadedAt: ISODateTime;
  uploadedById: ID;
  access: DocumentAccess;
  /** Member IDs allowed to open a restricted document. */
  allowedIds: ID[];
  appointmentId?: ID;
}

/* ─────────────────────── Notifications & audit ─────────────────────── */

export type NotificationType = 'task' | 'reassignment' | 'conflict' | 'availability' | 'appointment' | 'nutrition' | 'circle';

export interface NotificationItem {
  id: ID;
  type: NotificationType;
  message: string;
  createdAt: ISODateTime;
  read: boolean;
  href?: string;
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
  kind: 'task' | 'completed' | 'conflict' | 'appointment' | 'unavailable';
  title: string;
  subtitle?: string;
  start: ISODateTime;
  end: ISODateTime;
  memberId: ID | null;
  href?: string;
}

/* ─────────────────────── CareGraph ─────────────────────── */

export type GraphNodeKind = 'recipient' | 'goal' | 'appointment' | 'task' | 'member';

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
