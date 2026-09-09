/**
 * Decision engine — REFERENCE IMPLEMENTATION.
 *
 * In the target architecture this logic lives in the backend decision-service.
 * It runs in the browser only while `VITE_USE_MOCKS=true`, so the frontend can
 * be demonstrated end-to-end before the backend exists. Pages never import this
 * file; they call `decisionService`, which will switch to REST calls later.
 *
 * All functions are pure: same input → same output.
 */
import type {
  Appointment,
  CandidateScore,
  CareTask,
  Conflict,
  FamilyMember,
  PriorityBreakdown,
  SimulationChange,
  SimulationResult,
  Skill,
  TaskCategory,
  Unavailability,
} from '@/types/domain';

export interface EngineData {
  tasks: CareTask[];
  appointments: Appointment[];
  members: FamilyMember[];
  unavailability: Unavailability[];
}

/** Task Priority Score weights (sum = 1). */
export const PRIORITY_WEIGHTS = { deadline: 0.25, criticality: 0.25, dependency: 0.15, reassignment: 0.15, conflict: 0.2 };

/** Candidate Suitability Score weights. */
export const SUITABILITY_WEIGHTS = { availability: 0.35, workloadCapacity: 0.2, skillEligibility: 0.25, conflictCost: 0.3 };

/** Minutes of assigned care in one day that count as a "full" load. */
const FULL_DAY_LOAD_MIN = 240;

const CATEGORY_SKILLS: Record<TaskCategory, Skill[]> = {
  medication: ['medication', 'clinical'],
  vitals: ['clinical', 'medication'],
  meals: ['meals'],
  errands: ['errands', 'driving'],
  mobility: ['mobility'],
  transport: ['driving'],
  companionship: ['companionship'],
  other: [],
};

const MIN = 60_000;

interface Commitment {
  id: string;
  label: string;
  start: number;
  end: number;
}

export const taskStart = (t: CareTask) => new Date(t.start).getTime();
export const taskEnd = (t: CareTask) => taskStart(t) + t.durationMin * MIN;

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Everything a member is already committed to (tasks + appointment escorts). */
export function commitmentsFor(memberId: string, data: EngineData, excludeTaskId?: string): Commitment[] {
  const tasks = data.tasks
    .filter((t) => t.assigneeId === memberId && t.status === 'scheduled' && t.id !== excludeTaskId)
    .map((t) => ({ id: t.id, label: t.title, start: taskStart(t), end: taskEnd(t) }));
  // An appointment linked to a scheduled task is already represented by that task.
  const linked = new Set(data.tasks.filter((t) => t.status === 'scheduled' && t.appointmentId).map((t) => t.appointmentId));
  const escorts = data.appointments
    .filter((a) => a.escortId === memberId && !linked.has(a.id))
    .map((a) => {
      const start = new Date(a.start).getTime();
      return { id: a.id, label: `${a.title} (escort)`, start, end: start + a.durationMin * MIN };
    });
  return [...tasks, ...escorts];
}

/**
 * How well a time range sits inside a member's weekly availability.
 * 1 = fully inside a window, 0.5 = on an available day but outside the windows,
 * 0.6 = the member has not set availability (unknown), 0.2 = unavailable day.
 */
export function availabilityFit(member: FamilyMember, start: number, end: number): number {
  const { days, windows } = member.availability;
  if (!windows.length) return 0.6;
  const date = new Date(start);
  const dayIndex = (date.getDay() + 6) % 7;
  if (!days[dayIndex]) return 0.2;
  const s = date.getHours() * 60 + date.getMinutes();
  const e = s + (end - start) / MIN;
  return windows.some((w) => toMinutes(w.start) <= s && toMinutes(w.end) >= e) ? 1 : 0.5;
}

function reportedUnavailable(memberId: string, start: number, end: number, data: EngineData) {
  return data.unavailability.find(
    (u) => u.memberId === memberId && overlap(start, end, new Date(u.start).getTime(), new Date(u.end).getTime()) > 0,
  );
}

/**
 * One conflict per scheduled, not-yet-finished task (the most severe one).
 * Conflicts the lead explicitly chose to keep are left out.
 */
export function detectConflicts(data: EngineData, now: number = Date.now()): Conflict[] {
  return detectRaw(data, now).filter((c) => data.tasks.find((t) => t.id === c.taskId)?.acknowledgedConflict !== c.kind);
}

function detectRaw(data: EngineData, now: number): Conflict[] {
  const conflicts: Conflict[] = [];
  const memberById = new Map(data.members.map((m) => [m.id, m]));

  for (const task of data.tasks) {
    if (task.status !== 'scheduled' || taskEnd(task) < now) continue;
    const start = taskStart(task);
    const end = taskEnd(task);

    if (!task.assigneeId || !memberById.has(task.assigneeId)) {
      conflicts.push({ id: `c-${task.id}`, taskId: task.id, memberId: null, kind: 'unassigned', reason: 'No one is assigned to this task yet.', overlapMinutes: 0 });
      continue;
    }
    const member = memberById.get(task.assigneeId)!;
    const firstName = member.name.split(' ')[0];

    const away = reportedUnavailable(member.id, start, end, data);
    if (away) {
      conflicts.push({
        id: `c-${task.id}`,
        taskId: task.id,
        memberId: member.id,
        kind: 'reported-unavailable',
        reason: `${firstName} reported being unavailable${away.reason ? ` (${away.reason.toLowerCase()})` : ''}.`,
        overlapMinutes: task.durationMin,
        otherLabel: away.reason || 'Unavailable',
      });
      continue;
    }

    const clash = commitmentsFor(member.id, data, task.id)
      .map((c) => ({ c, minutes: overlap(start, end, c.start, c.end) / MIN }))
      .filter((x) => x.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)[0];
    if (clash) {
      conflicts.push({
        id: `c-${task.id}`,
        taskId: task.id,
        memberId: member.id,
        kind: 'overlap',
        reason: `${firstName} is also booked for “${clash.c.label}” — they overlap by ${Math.round(clash.minutes)} min.`,
        overlapMinutes: Math.round(clash.minutes),
        otherLabel: clash.c.label,
      });
      continue;
    }

    if (availabilityFit(member, start, end) < 1 && member.availability.windows.length) {
      conflicts.push({
        id: `c-${task.id}`,
        taskId: task.id,
        memberId: member.id,
        kind: 'outside-availability',
        reason: `This is outside ${firstName}’s usual availability.`,
        overlapMinutes: 0,
      });
    }
  }
  return conflicts;
}

/** Minutes of scheduled care assigned to a member on the day of `at`. */
export function dayLoadMinutes(memberId: string, at: number, data: EngineData, excludeTaskId?: string): number {
  return commitmentsFor(memberId, data, excludeTaskId)
    .filter((c) => sameDay(c.start, at))
    .reduce((sum, c) => sum + (c.end - c.start) / MIN, 0);
}

/** Candidate Suitability Score for every eligible member, best first. */
export function scoreCandidates(task: CareTask, data: EngineData): CandidateScore[] {
  const start = taskStart(task);
  const end = taskEnd(task);
  const needed = CATEGORY_SKILLS[task.category];
  const w = SUITABILITY_WEIGHTS;
  const maxRaw = w.availability + w.workloadCapacity + w.skillEligibility;

  return data.members
    .filter((m) => m.id !== task.assigneeId && m.status === 'active' && m.role !== 'observer')
    .map((m) => {
      const firstName = m.name.split(' ')[0];
      const reasons: string[] = [];
      const cautions: string[] = [];

      const away = reportedUnavailable(m.id, start, end, data);
      let availability = away ? 0 : availabilityFit(m, start, end);
      if (away) cautions.push(`${firstName} reported being unavailable at this time.`);
      else if (availability === 1) reasons.push('Free during this time window.');
      else if (availability === 0.6) cautions.push(`${firstName} hasn’t shared their availability yet.`);
      else cautions.push('Outside their usual availability.');

      const overlapMin = commitmentsFor(m.id, data, task.id).reduce((s, c) => s + overlap(start, end, c.start, c.end) / MIN, 0);
      const conflictCost = Math.min(1, overlapMin / Math.max(task.durationMin, 1) + (away ? 1 : 0));
      if (overlapMin > 0) {
        cautions.push(`Overlaps another commitment by ${Math.round(overlapMin)} min.`);
        availability = Math.min(availability, 0.5);
      }

      const load = dayLoadMinutes(m.id, start, data, task.id);
      const workloadCapacity = Math.max(0, 1 - load / FULL_DAY_LOAD_MIN);
      const tasksThatDay = commitmentsFor(m.id, data, task.id).filter((c) => sameDay(c.start, start)).length;
      if (tasksThatDay === 0) reasons.push('Nothing else scheduled that day.');
      else if (workloadCapacity >= 0.6) reasons.push(`Light day — ${tasksThatDay} other commitment${tasksThatDay > 1 ? 's' : ''}.`);
      else cautions.push(`Busy day — ${Math.round(load / 60)} h already assigned.`);

      const hasSkill = needed.length === 0 || needed.some((s) => m.skills.includes(s));
      const skillEligibility = hasSkill ? 1 : 0.5;
      if (hasSkill && needed.length) reasons.push(`Can help with ${needed.filter((s) => m.skills.includes(s)).join(' & ')}.`);
      else if (!hasSkill) cautions.push(`Hasn’t listed ${needed.join(' or ')} as something they help with.`);

      const raw =
        w.availability * availability + w.workloadCapacity * workloadCapacity + w.skillEligibility * skillEligibility - w.conflictCost * conflictCost;
      const score = Math.round(Math.max(0, Math.min(1, raw / maxRaw)) * 100);

      return {
        memberId: m.id,
        score,
        factors: { availability, workloadCapacity: Number(workloadCapacity.toFixed(2)), skillEligibility, conflictCost: Number(conflictCost.toFixed(2)) },
        tasksThatDay,
        overlapMinutes: Math.round(overlapMin),
        reasons,
        cautions,
      };
    })
    .sort((a, b) => b.score - a.score);
}

const CRITICAL_CATEGORIES: TaskCategory[] = ['medication', 'vitals', 'transport'];

/** Task Priority Score, with a plain-language explanation. */
export function priorityScore(task: CareTask, data: EngineData, conflict?: Conflict, now: number = Date.now()): PriorityBreakdown {
  const hours = (taskStart(task) - now) / 3_600_000;
  const deadline = hours <= 2 ? 1 : hours <= 6 ? 0.8 : hours <= 24 ? 0.6 : hours <= 72 ? 0.35 : 0.15;

  const base = task.priority === 'urgent' ? 0.85 : task.priority === 'important' ? 0.6 : 0.3;
  const criticality = Math.min(1, base + (CRITICAL_CATEGORIES.includes(task.category) ? 0.15 : 0));

  const dependency = task.appointmentId ? 1 : task.category === 'transport' ? 0.8 : task.category === 'medication' ? 0.6 : 0.3;

  const candidates = scoreCandidates(task, data);
  const good = candidates.filter((c) => c.score >= 60).length;
  const reassignment = candidates.length ? 1 - good / candidates.length : 1;

  let conflictSeverity = 0;
  if (conflict) {
    if (conflict.kind === 'unassigned' || conflict.kind === 'reported-unavailable') conflictSeverity = 1;
    else if (conflict.kind === 'overlap') conflictSeverity = 0.2 + 0.8 * Math.min(1, conflict.overlapMinutes / Math.max(task.durationMin, 1));
    else conflictSeverity = 0.4;
  }

  const factors = { deadline, criticality, dependency, reassignment: Number(reassignment.toFixed(2)), conflict: Number(conflictSeverity.toFixed(2)) };
  const w = PRIORITY_WEIGHTS;
  const score = Math.round(
    100 *
      (w.deadline * deadline + w.criticality * criticality + w.dependency * dependency + w.reassignment * reassignment + w.conflict * conflictSeverity),
  );

  const parts: string[] = [];
  if (hours < 0) parts.push('it is already due');
  else if (hours <= 6) parts.push(`it starts in ${hours < 1 ? 'under an hour' : `${Math.round(hours)} h`}`);
  if (criticality >= 0.75) parts.push('it is a critical care activity');
  if (task.appointmentId) parts.push('a clinic visit depends on it');
  if (conflictSeverity >= 0.6) parts.push('the current plan cannot go ahead');
  if (reassignment >= 0.6) parts.push('few people are free to take it');
  const reasons = parts.join(', ');
  const Reasons = reasons.charAt(0).toUpperCase() + reasons.slice(1);
  const explanation = !parts.length
    ? 'No urgent pressure on this task right now.'
    : score >= 70
      ? `Ranked high because ${reasons}.`
      : score >= 45
        ? `Medium priority. ${Reasons}.`
        : `Low priority for now. Worth knowing: ${reasons}.`;

  return { score, factors, explanation };
}

/** Apply a hypothetical change and compare conflicts & workload. Nothing is saved. */
export function simulate(change: SimulationChange, data: EngineData, now: number = Date.now()): SimulationResult {
  const target = data.tasks.find((t) => t.id === change.taskId);
  const changedTasks = data.tasks.map((t) =>
    t.id === change.taskId
      ? { ...t, assigneeId: change.assigneeId !== undefined ? change.assigneeId : t.assigneeId, start: change.start ?? t.start }
      : t,
  );
  const after: EngineData = { ...data, tasks: changedTasks };
  const conflictsBefore = detectConflicts(data, now);
  const conflictsAfter = detectConflicts(after, now);
  const key = (c: Conflict) => `${c.taskId}:${c.kind}`;
  const beforeKeys = new Set(conflictsBefore.map(key));
  const afterKeys = new Set(conflictsAfter.map(key));

  const day = target ? taskStart(target) : now;
  const changedDay = change.start ? new Date(change.start).getTime() : day;
  const workload = data.members
    .filter((m) => m.status === 'active')
    .map((m) => ({
      memberId: m.id,
      before: Math.round(dayLoadMinutes(m.id, day, data)),
      after: Math.round(dayLoadMinutes(m.id, changedDay, after)),
    }))
    .filter((w) => w.before !== w.after || [target?.assigneeId, change.assigneeId].includes(w.memberId));

  return {
    change,
    conflictsBefore,
    conflictsAfter,
    resolved: conflictsBefore.filter((c) => !afterKeys.has(key(c))),
    introduced: conflictsAfter.filter((c) => !beforeKeys.has(key(c))),
    workload,
  };
}
