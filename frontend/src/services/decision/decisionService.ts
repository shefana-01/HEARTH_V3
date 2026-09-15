/**
 * Decision engine API — decision-service. REST contract: not defined yet.
 *
 * While mocks are enabled, results are computed by the reference
 * implementation in `./engine.ts`.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { audit, db, fail, firstName, memberName, newId, notFound, notify, nowIso, persist, respond } from '../mockStore';
import { detectConflicts, priorityScore, scoreCandidates, simulate, type EngineData } from './engine';
import type {
  CandidateScore,
  CareTask,
  Conflict,
  PriorityBreakdown,
  ReassignmentRequest,
  SimulationChange,
  SimulationResult,
} from '@/types/domain';

export { PRIORITY_WEIGHTS, SUITABILITY_WEIGHTS } from './engine';

const data = (): EngineData => ({
  tasks: db.tasks,
  appointments: db.appointments,
  members: db.members,
  unavailability: db.unavailability,
});

export interface AttentionItem {
  conflict: Conflict;
  task: CareTask;
  priority: PriorityBreakdown;
  topCandidate?: CandidateScore;
  openRequestId?: string;
}

export interface TaskInsight {
  conflict?: Conflict;
  priority: PriorityBreakdown;
  candidates: CandidateScore[];
  openRequestId?: string;
}

export interface RequestView {
  request: ReassignmentRequest;
  task: CareTask;
  candidates: CandidateScore[];
  conflict?: Conflict;
}

const openRequestFor = (taskId: string) => db.reassignments.find((r) => r.taskId === taskId && r.status === 'open');

function ensureRequest(taskId: string, reason: string, note = ''): ReassignmentRequest {
  const existing = openRequestFor(taskId);
  if (existing) return existing;
  const task = db.tasks.find((t) => t.id === taskId)!;
  const request: ReassignmentRequest = {
    id: newId('rq'),
    taskId,
    fromMemberId: task.assigneeId,
    reason,
    note,
    createdAt: nowIso(),
    createdById: db.account?.memberId ?? 'unknown',
    status: 'open',
  };
  db.reassignments.push(request);
  return request;
}

export const decisionService = {
  /** Everything that needs a decision, highest Task Priority Score first. */
  async listAttention(): Promise<AttentionItem[]> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'listAttention');
    const d = data();
    const items = detectConflicts(d).map((conflict) => {
      const task = d.tasks.find((t) => t.id === conflict.taskId)!;
      return {
        conflict,
        task,
        priority: priorityScore(task, d, conflict),
        topCandidate: scoreCandidates(task, d)[0],
        openRequestId: openRequestFor(task.id)?.id,
      };
    });
    return respond(items.sort((a, b) => b.priority.score - a.priority.score));
  },

  async getTaskInsight(taskId: string): Promise<TaskInsight> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'getTaskInsight');
    const d = data();
    const task = d.tasks.find((t) => t.id === taskId);
    if (!task) return notFound('That task');
    const conflict = detectConflicts(d).find((c) => c.taskId === taskId);
    return respond({
      conflict,
      priority: priorityScore(task, d, conflict),
      candidates: scoreCandidates(task, d),
      openRequestId: openRequestFor(taskId)?.id,
    });
  },

  /**
   * Score every member for a task that is still being drafted, so the form can
   * warn about clashes before the task is saved.
   */
  async previewCandidates(draft: { taskId?: string; category: CareTask['category']; start: string; durationMin: number }): Promise<CandidateScore[]> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'previewCandidates');
    const temp: CareTask = {
      id: draft.taskId ?? '__draft__',
      title: 'Draft',
      notes: '',
      category: draft.category,
      priority: 'routine',
      status: 'scheduled',
      start: draft.start,
      durationMin: draft.durationMin,
      assigneeId: null,
      createdById: '',
      createdAt: nowIso(),
      reminder: false,
    };
    return respond(scoreCandidates(temp, data()));
  },

  /** Open a reassignment request for a task (idempotent). */
  async requestReassignment(taskId: string, reason: string, note = ''): Promise<ReassignmentRequest> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'requestReassignment');
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) return notFound('That task');
    const request = ensureRequest(taskId, reason, note);
    audit({ category: 'tasks', action: 'Requested a reassignment', subject: task.title, after: reason });
    persist();
    return respond(request);
  },

  async listRequests(): Promise<(ReassignmentRequest & { taskTitle: string; taskStart: string })[]> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'listRequests');
    const list = db.reassignments
      .map((r) => {
        const task = db.tasks.find((t) => t.id === r.taskId);
        return { ...r, taskTitle: task?.title ?? 'Removed task', taskStart: task?.start ?? r.createdAt };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return respond(list);
  },

  async getRequest(id: string): Promise<RequestView> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'getRequest');
    const request = db.reassignments.find((r) => r.id === id);
    const task = request && db.tasks.find((t) => t.id === request.taskId);
    if (!request || !task) return notFound('That reassignment request');
    const d = data();
    // Score against the original assignee so they are excluded from candidates.
    const scored = scoreCandidates({ ...task, assigneeId: request.fromMemberId }, d);
    return respond({ request, task, candidates: scored, conflict: detectConflicts(d).find((c) => c.taskId === task.id) });
  },

  async approveRequest(id: string, memberId: string): Promise<ReassignmentRequest> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'approveRequest');
    const request = db.reassignments.find((r) => r.id === id);
    const task = request && db.tasks.find((t) => t.id === request.taskId);
    if (!request || !task) return notFound('That reassignment request');
    if (request.status !== 'open') return fail('This request has already been resolved.', 409);
    if (!db.members.some((m) => m.id === memberId)) return notFound('That family member');

    task.assigneeId = memberId;
    task.acknowledgedConflict = undefined;
    if (task.appointmentId) {
      const appt = db.appointments.find((a) => a.id === task.appointmentId);
      if (appt) appt.escortId = memberId;
    }
    request.status = 'approved';
    request.approvedMemberId = memberId;
    request.resolvedAt = nowIso();

    audit({ category: 'tasks', action: 'Approved a reassignment', subject: task.title, before: memberName(request.fromMemberId), after: memberName(memberId) });
    notify({ type: 'reassignment', message: `${firstName(memberId)} took over “${task.title}” from ${firstName(request.fromMemberId)}.`, href: `/tasks/${task.id}` });
    persist();
    return respond(request);
  },

  async cancelRequest(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'cancelRequest');
    const request = db.reassignments.find((r) => r.id === id);
    if (!request) return notFound('That reassignment request');
    request.status = 'cancelled';
    request.resolvedAt = nowIso();
    persist();
    return respond(undefined);
  },

  /** Keep the current plan even though a conflict was detected. */
  async acknowledgeConflict(taskId: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'acknowledgeConflict');
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) return notFound('That task');
    const conflict = detectConflicts(data()).find((c) => c.taskId === taskId);
    if (conflict) {
      task.acknowledgedConflict = conflict.kind;
      audit({ category: 'tasks', action: 'Kept a task despite a conflict', subject: task.title, after: conflict.reason });
      persist();
    }
    return respond(undefined);
  },

  /** What-if: evaluate a change without saving it. */
  async simulate(change: SimulationChange): Promise<SimulationResult> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'simulate');
    if (!db.tasks.some((t) => t.id === change.taskId)) return notFound('That task');
    return respond(simulate(change, data()));
  },

  /** Apply a simulated change to the live schedule. */
  async applySimulation(change: SimulationChange): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('decision-service', 'applySimulation');
    const task = db.tasks.find((t) => t.id === change.taskId);
    if (!task) return notFound('That task');
    const before = `${memberName(task.assigneeId)} · ${task.start}`;
    if (change.assigneeId !== undefined) task.assigneeId = change.assigneeId;
    if (change.start) task.start = change.start;
    task.acknowledgedConflict = undefined;
    const open = openRequestFor(task.id);
    if (open && change.assigneeId) {
      open.status = 'approved';
      open.approvedMemberId = change.assigneeId;
      open.resolvedAt = nowIso();
    }
    audit({ category: 'schedule', action: 'Applied a what-if change', subject: task.title, before, after: `${memberName(task.assigneeId)} · ${task.start}` });
    notify({ type: 'task', message: `The schedule for “${task.title}” was updated from the what-if simulator.`, href: `/tasks/${task.id}` });
    persist();
    return respond(task);
  },
};
