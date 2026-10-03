/**
 * Decision engine — REFERENCE IMPLEMENTATION.
 *
 * With the backend, this logic lives in decision-service (`DecisionEngine.java`,
 * a line-by-line port). It runs in the browser while `VITE_USE_MOCKS=true`, so
 * the app can be used end-to-end without a server. Pages never import this
 * file; they call `decisionService`.
 *
 * It answers four questions:
 *   1. Which tasks cannot go ahead as planned?            → detectConflicts
 *   2. Who is the best person to take a task over?        → scoreCandidates
 *   3. How pressing is a task?                            → priorityScore
 *   4. In what order should one person do their tasks?    → rankTasks
 *
 * All functions are pure: same input → same output.
 */
import type {
  Appointment,
  BusyBlock,
  CandidateScore,
  Conflict,
  FamilyMember,
  PriorityBreakdown,
  RankedTask,
  SimulationChange,
  SimulationResult,
  Skill,
  Task,
  TaskCategory,
  Unavailability,
} from '@/types/domain';

export interface EngineData {
  tasks: Task[];
  appointments: Appointment[];
  members: FamilyMember[];
  unavailability: Unavailability[];
  /** Personal events, already expanded into concrete blocks (see `lib/recurrence.ts`). */
  busy: BusyBlock[];
  /** Members who keep their own calendar in Hearth (at least one personal event). */
  calendarOwners: string[];
  /**
   * Whose eyes the result is for. Private tasks and events of other people are
   * described as "a personal commitment", and conflicts on private tasks are
   * only reported to their owner.
   */
  viewerId?: string;
}

/** Task Priority Score weights (sum = 1). */
export const PRIORITY_WEIGHTS = { deadline: 0.25, criticality: 0.25, dependency: 0.15, reassignment: 0.15, conflict: 0.2 };

/** Candidate Suitability Score weights. */
export const SUITABILITY_WEIGHTS = { availability: 0.35, workloadCapacity: 0.2, skillEligibility: 0.25, conflictCost: 0.3 };

/** Minutes of tasks and appointments in one day that count as a "full" load. */
const FULL_DAY_LOAD_MIN = 240;

const CATEGORY_SKILLS: Record<TaskCategory, Skill[]> = {
  medication: ['medication', 'clinical'],
  health: ['clinical', 'medication'],
  meals: ['meals'],
  errands: ['errands', 'driving'],
  household: ['household'],
  childcare: ['childcare'],
  transport: ['driving'],
  study: [],
  work: [],
  exercise: ['mobility'],
  family: ['companionship'],
  other: [],
};

/** Getting these wrong affects someone's health or safety. */
const CRITICAL_CATEGORIES: TaskCategory[] = ['medication', 'health', 'transport', 'childcare'];

const MIN = 60_000;
const PERSONAL = 'a personal commitment';

interface Commitment {
  id: string;
  /** Ready to drop into a sentence: “Title” in quotes, or "a personal commitment". */
  label: string;
  start: number;
  end: number;
  /** Tasks and appointments count towards the day's workload; personal events do not. */
  duty: boolean;
}

export const taskStart = (t: Task) => new Date(t.start).getTime();
export const taskEnd = (t: Task) => taskStart(t) + t.durationMin * MIN;

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

const quoted = (title: string) => `“${title}”`;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Everything a member is already committed to: their tasks, appointments
 * they attend or go along to, and their personal events.
 */
export function commitmentsFor(memberId: string, data: EngineData, excludeTaskId?: string): Commitment[] {
  const mine = memberId === data.viewerId;
  const own = data.tasks.filter((t) => t.assigneeId === memberId && t.status === 'scheduled');
  const tasks = own
    .filter((t) => t.id !== excludeTaskId)
    .map((t) => ({ id: t.id, label: t.visibility === 'private' && !mine ? PERSONAL : quoted(t.title), start: taskStart(t), end: taskEnd(t), duty: true }));

  // An appointment that one of this member's own tasks is linked to is already represented by that task.
  const linked = new Set(own.filter((t) => t.appointmentId).map((t) => t.appointmentId));
  const appointments = data.appointments
    .filter((a) => (a.forId === memberId || a.escortId === memberId) && !linked.has(a.id))
    .map((a) => {
      const start = new Date(a.start).getTime();
      const label = a.visibility === 'private' && !mine ? PERSONAL : a.forId === memberId ? quoted(a.title) : `${quoted(a.title)} (going along)`;
      return { id: a.id, label, start, end: start + a.durationMin * MIN, duty: true };
    });

  const events = data.busy
    .filter((b) => b.memberId === memberId)
    .map((b) => ({ id: b.id, label: b.hidden && !mine ? PERSONAL : quoted(b.label), start: new Date(b.start).getTime(), end: new Date(b.end).getTime(), duty: false }));

  return [...tasks, ...appointments, ...events];
}

/**
 * How well a time range sits inside a member's weekly availability.
 * 1 = fully inside a window, 0.5 = on an available day but outside the windows,
 * 0.2 = a day they marked as off. With no windows set: 0.9 if they keep their
 * calendar in Hearth (so a clear calendar means something), otherwise 0.6 (unknown).
 */
export function availabilityFit(member: FamilyMember, start: number, end: number, data?: EngineData): number {
  const { days, windows } = member.availability;
  if (!windows.length) return data?.calendarOwners.includes(member.id) ? 0.9 : 0.6;
  const date = new Date(start);
  const dayIndex = (date.getDay() + 6) % 7;
  if (!days[dayIndex]) return 0.2;
  const s = date.getHours() * 60 + date.getMinutes();
  const e = s + (end - start) / MIN;
  return windows.some((w) => toMinutes(w.start) <= s && toMinutes(w.end) >= e) ? 1 : 0.5;
}

function reportedUnavailable(memberId: string, start: number, end: number, data: EngineData) {
  return data.unavailability.find((u) => u.memberId === memberId && overlap(start, end, new Date(u.start).getTime(), new Date(u.end).getTime()) > 0);
}

/**
 * One conflict per scheduled, not-yet-finished task (the most severe one).
 * Conflicts the owner explicitly chose to keep are left out.
 */
export function detectConflicts(data: EngineData, now: number = Date.now()): Conflict[] {
  return detectRaw(data, now).filter((c) => data.tasks.find((t) => t.id === c.taskId)?.acknowledgedConflict !== c.kind);
}

function detectRaw(data: EngineData, now: number): Conflict[] {
  const conflicts: Conflict[] = [];
  const memberById = new Map(data.members.map((m) => [m.id, m]));

  for (const task of data.tasks) {
    if (task.status !== 'scheduled' || taskEnd(task) < now) continue;
    // A private task is its owner's business: nobody else is told it clashes.
    if (task.visibility === 'private' && task.assigneeId !== data.viewerId) continue;
    const start = taskStart(task);
    const end = taskEnd(task);

    if (!task.assigneeId || !memberById.has(task.assigneeId)) {
      conflicts.push({ id: `c-${task.id}`, taskId: task.id, memberId: null, kind: 'unassigned', reason: 'No one has taken this task yet.', overlapMinutes: 0 });
      continue;
    }
    const member = memberById.get(task.assigneeId)!;
    // Written to the person reading it: "You also have…" for their own tasks, "Rafid also has…" otherwise.
    const own = member.id === data.viewerId;
    const firstName = member.name.split(' ')[0];

    const away = reportedUnavailable(member.id, start, end, data);
    if (away) {
      conflicts.push({
        id: `c-${task.id}`,
        taskId: task.id,
        memberId: member.id,
        kind: 'reported-unavailable',
        reason: `${own ? 'You said you are' : `${firstName} said they are`} unavailable${away.reason ? ` (${away.reason.toLowerCase()})` : ''}.`,
        overlapMinutes: task.durationMin,
        otherLabel: away.reason || 'Unavailable',
      });
      continue;
    }

    const clash = commitmentsFor(member.id, data, task.id)
      .map((c) => ({ c, minutes: overlap(start, end, c.start, c.end) / MIN }))
      .filter((x) => x.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes || a.c.id.localeCompare(b.c.id))[0];
    if (clash) {
      conflicts.push({
        id: `c-${task.id}`,
        taskId: task.id,
        memberId: member.id,
        kind: 'overlap',
        reason: `${own ? 'You also have' : `${firstName} also has`} ${clash.c.label} then — they overlap by ${Math.round(clash.minutes)} min.`,
        overlapMinutes: Math.round(clash.minutes),
        otherLabel: clash.c.label,
      });
      continue;
    }

    if (member.availability.windows.length && availabilityFit(member, start, end, data) < 1) {
      conflicts.push({
        id: `c-${task.id}`,
        taskId: task.id,
        memberId: member.id,
        kind: 'outside-availability',
        reason: `This is outside the times ${own ? 'you are' : `${firstName} is`} usually free.`,
        overlapMinutes: 0,
      });
    }
  }
  return conflicts;
}

/** Minutes of tasks and appointments a member has on the day of `at`. Personal events are not counted. */
export function dayLoadMinutes(memberId: string, at: number, data: EngineData, excludeTaskId?: string): number {
  return commitmentsFor(memberId, data, excludeTaskId)
    .filter((c) => c.duty && sameDay(c.start, at))
    .reduce((sum, c) => sum + (c.end - c.start) / MIN, 0);
}

/**
 * Candidate Suitability Score for everyone who could take the task, best first.
 * A private task has no candidates: it is never offered to someone else.
 */
export function scoreCandidates(task: Task, data: EngineData): CandidateScore[] {
  if (task.visibility === 'private') return [];
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
      const commitments = commitmentsFor(m.id, data, task.id);

      const away = reportedUnavailable(m.id, start, end, data);
      const overlapMin = commitments.reduce((s, c) => s + overlap(start, end, c.start, c.end) / MIN, 0);
      const conflictCost = Math.min(1, overlapMin / Math.max(task.durationMin, 1) + (away ? 1 : 0));

      // Being away rules someone out; a clash caps how available they can count as.
      let availability = away ? 0 : availabilityFit(m, start, end, data);
      if (overlapMin > 0) availability = Math.min(availability, 0.5);
      if (away) cautions.push(`${firstName} said they are unavailable at this time.`);
      else if (overlapMin > 0) cautions.push(`Already has something else then (${Math.round(overlapMin)} min overlap).`);
      else if (availability === 1) reasons.push('Free during this time.');
      else if (availability === 0.9) reasons.push('Nothing on their calendar at this time.');
      else if (availability === 0.6) cautions.push(`${firstName} hasn’t shared their schedule yet.`);
      else cautions.push('Outside the times they are usually free.');

      const duties = commitments.filter((c) => c.duty && sameDay(c.start, start));
      const load = duties.reduce((sum, c) => sum + (c.end - c.start) / MIN, 0);
      const workloadCapacity = Math.max(0, 1 - load / FULL_DAY_LOAD_MIN);
      const tasksThatDay = duties.length;
      if (tasksThatDay === 0) reasons.push('No other tasks that day.');
      else if (workloadCapacity >= 0.6) reasons.push(`Light day — ${tasksThatDay} other task${tasksThatDay > 1 ? 's' : ''}.`);
      else cautions.push(`Busy day — ${Math.round(load / 60)} h of tasks already.`);

      const hasSkill = needed.length === 0 || needed.some((s) => m.skills.includes(s));
      const skillEligibility = hasSkill ? 1 : 0.5;
      if (hasSkill && needed.length) reasons.push(`Can help with ${needed.filter((s) => m.skills.includes(s)).join(' & ')}.`);
      else if (!hasSkill) cautions.push(`Hasn’t listed ${needed.join(' or ')} as something they help with.`);

      const raw = w.availability * availability + w.workloadCapacity * workloadCapacity + w.skillEligibility * skillEligibility - w.conflictCost * conflictCost;
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

/** Task Priority Score, with a plain-language explanation. */
export function priorityScore(task: Task, data: EngineData, conflict?: Conflict, now: number = Date.now()): PriorityBreakdown {
  const hours = (taskStart(task) - now) / 3_600_000;
  const deadline = hours <= 2 ? 1 : hours <= 6 ? 0.8 : hours <= 24 ? 0.6 : hours <= 72 ? 0.35 : 0.15;

  const base = task.priority === 'urgent' ? 0.85 : task.priority === 'important' ? 0.6 : 0.3;
  const criticality = Math.min(1, base + (CRITICAL_CATEGORIES.includes(task.category) ? 0.15 : 0));

  const dependency = task.appointmentId ? 1 : task.category === 'transport' ? 0.8 : task.category === 'medication' || task.category === 'childcare' ? 0.6 : 0.3;

  // How hard it would be to find someone else. A private task can only be done by its owner.
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
  const score = Math.round(100 * (w.deadline * deadline + w.criticality * criticality + w.dependency * dependency + w.reassignment * reassignment + w.conflict * conflictSeverity));

  const parts: string[] = [];
  if (hours < 0) parts.push('it is already due');
  else if (hours <= 6) parts.push(`it starts in ${hours < 1 ? 'under an hour' : `${Math.round(hours)} h`}`);
  if (CRITICAL_CATEGORIES.includes(task.category) && criticality >= 0.75) parts.push('it matters for someone’s health or safety');
  else if (task.priority === 'urgent') parts.push('it is marked urgent');
  if (task.appointmentId) parts.push('an appointment depends on it');
  if (conflictSeverity >= 0.6) parts.push('the current plan cannot go ahead');
  if (task.visibility === 'private') parts.push('only you can do it');
  else if (reassignment >= 0.6) parts.push('few people are free to take it');
  const reasons = parts.join(', ');
  const Reasons = reasons.charAt(0).toUpperCase() + reasons.slice(1);
  const explanation = !parts.length
    ? 'Nothing is pressing on this task right now.'
    : score >= 70
      ? `Ranked high because ${reasons}.`
      : score >= 45
        ? `Medium priority. ${Reasons}.`
        : `Low priority for now. Worth knowing: ${reasons}.`;

  return { score, factors, explanation };
}

interface Scored {
  task: Task;
  priority: PriorityBreakdown;
}

/**
 * What decides the order when two tasks have the same Priority Score, in turn:
 * the one due sooner, the one more depends on, the one that is harder to hand
 * over, the one that matters more, the quicker one. The id is the last resort
 * so the order never changes between two looks at the same data.
 */
const TIE_BREAKERS: { because: string; compare: (a: Scored, b: Scored) => number }[] = [
  { because: 'it is due sooner', compare: (a, b) => taskStart(a.task) - taskStart(b.task) },
  { because: 'more depends on it', compare: (a, b) => b.priority.factors.dependency - a.priority.factors.dependency },
  { because: 'it is harder to hand over', compare: (a, b) => b.priority.factors.reassignment - a.priority.factors.reassignment },
  { because: 'it matters more', compare: (a, b) => b.priority.factors.criticality - a.priority.factors.criticality },
  { because: 'it is quicker to finish', compare: (a, b) => a.task.durationMin - b.task.durationMin },
];

/** Highest Priority Score first, then the tie-breakers in order. */
export function compareByPriority(a: Scored, b: Scored): number {
  if (a.priority.score !== b.priority.score) return b.priority.score - a.priority.score;
  for (const rule of TIE_BREAKERS) {
    const diff = rule.compare(a, b);
    if (diff !== 0) return diff;
  }
  return a.task.id.localeCompare(b.task.id);
}

/** Why `first` is placed before `second` although both have the same score. `undefined` if the scores differ. */
export function tieBreakReason(first: Scored, second: Scored): string | undefined {
  if (first.priority.score !== second.priority.score) return undefined;
  const rule = TIE_BREAKERS.find((r) => r.compare(first, second) !== 0);
  if (!rule) return `Same score as ${quoted(second.task.title)}, and nothing sets them apart — do either first.`;
  return `Same score as ${quoted(second.task.title)}. This one comes first because ${rule.because}.`;
}

const ADVICE_ORDER = { now: 0, next: 1, later: 2 } as const;

/**
 * One person's open tasks in the order to do them.
 *
 * Time comes first: `now` = starts within two hours or is overdue, `next` =
 * later the same day, `later` = from tomorrow on, so it can safely wait.
 * Inside each group the Priority Score decides, then the tie-breakers.
 */
export function rankTasks(memberId: string, data: EngineData, now: number = Date.now()): RankedTask[] {
  const view: EngineData = { ...data, viewerId: memberId };
  const conflicts = new Map(detectConflicts(view, now).map((c) => [c.taskId, c]));
  const scored = view.tasks
    .filter((t) => t.assigneeId === memberId && t.status === 'scheduled')
    .map((task) => {
      const startsInMin = Math.round((taskStart(task) - now) / MIN);
      const advice: RankedTask['advice'] = startsInMin <= 120 ? 'now' : sameDay(taskStart(task), now) ? 'next' : 'later';
      return { task, conflict: conflicts.get(task.id), priority: priorityScore(task, view, conflicts.get(task.id), now), startsInMin, advice };
    })
    .sort((a, b) => ADVICE_ORDER[a.advice] - ADVICE_ORDER[b.advice] || compareByPriority(a, b));

  return scored.map((item, i) => {
    const next = scored[i + 1];
    return { ...item, rank: i + 1, tieBreak: next && next.advice === item.advice ? tieBreakReason(item, next) : undefined };
  });
}

/** Apply a hypothetical change and compare conflicts & workload. Nothing is saved. */
export function simulate(change: SimulationChange, data: EngineData, now: number = Date.now()): SimulationResult {
  const target = data.tasks.find((t) => t.id === change.taskId);
  const changedTasks = data.tasks.map((t) => (t.id === change.taskId ? { ...t, assigneeId: change.assigneeId !== undefined ? change.assigneeId : t.assigneeId, start: change.start ?? t.start } : t));
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
