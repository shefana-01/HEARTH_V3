/**
 * Decision engine API — decision-service.
 *
 * While mocks are enabled, results are computed by the reference
 * implementation in `./engine.ts`.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, audit, canSeeTask, db, engineData, fail, firstName, isLead, memberName, newId, notFound, notify, nowIso, persist, postSystemMessage, respond } from '../mockStore';
import { compareByPriority, detectConflicts, priorityScore, rankTasks, scoreCandidates, simulate } from './engine';
import type { CandidateScore, Conflict, PriorityBreakdown, RankedTask, ReassignmentRequest, SimulationChange, SimulationResult, Task } from '@/types/domain';

export { PRIORITY_WEIGHTS, SUITABILITY_WEIGHTS } from './engine';

export interface AttentionItem {
  conflict: Conflict;
  task: Task;
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
  task: Task;
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
    createdById: actorId(),
    status: 'open',
  };
  db.reassignments.push(request);
  return request;
}

/**
 * Who may settle a handover: the organiser, the person giving the task up (or
 * whoever asked), and anyone volunteering themselves.
 */
export function canApproveHandover(request: Pick<ReassignmentRequest, 'fromMemberId' | 'createdById'>, toMemberId: string, viewer: { id: string; role: string } | undefined): boolean {
  if (!viewer) return false;
  return viewer.role === 'lead' || viewer.id === request.fromMemberId || viewer.id === request.createdById || viewer.id === toMemberId;
}

export const decisionService = {
  /** Shared tasks that cannot go ahead as planned, most pressing first. */
  async listAttention(): Promise<AttentionItem[]> {
    if (!config.useMocks) return apiRequest<AttentionItem[]>('/decisions/attention');
    const d = engineData();
    // Private tasks are their owner's to sort out (they show up in "My day"), so only shared ones are listed here.
    const shared = detectConflicts(d).filter((c) => d.tasks.find((t) => t.id === c.taskId)?.visibility === 'family');
    const items = shared.map((conflict) => {
      const task = d.tasks.find((t) => t.id === conflict.taskId)!;
      return {
        conflict,
        task,
        priority: priorityScore(task, d, conflict),
        topCandidate: scoreCandidates(task, d)[0],
        openRequestId: openRequestFor(task.id)?.id,
      };
    });
    return respond(items.sort(compareByPriority));
  },

  /** The signed-in person's open tasks in the order to do them, with the reason for each place. */
  async getMyDay(): Promise<RankedTask[]> {
    if (!config.useMocks) return apiRequest<RankedTask[]>('/decisions/my-day');
    return respond(rankTasks(actorId(), engineData()));
  },

  async getTaskInsight(taskId: string): Promise<TaskInsight> {
    if (!config.useMocks) return apiRequest<TaskInsight>(`/decisions/tasks/${taskId}/insight`);
    const d = engineData();
    const task = d.tasks.find((t) => t.id === taskId && canSeeTask(t));
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
  async previewCandidates(draft: { taskId?: string; category: Task['category']; start: string; durationMin: number }): Promise<CandidateScore[]> {
    if (!config.useMocks) return apiRequest<CandidateScore[]>('/decisions/candidates/preview', { method: 'POST', body: draft });
    const temp: Task = {
      id: draft.taskId ?? '__draft__',
      title: 'Draft',
      notes: '',
      category: draft.category,
      priority: 'routine',
      status: 'scheduled',
      start: draft.start,
      durationMin: draft.durationMin,
      assigneeId: null,
      visibility: 'family',
      createdById: '',
      createdAt: nowIso(),
      reminder: false,
    };
    return respond(scoreCandidates(temp, engineData()));
  },

  /** Ask for someone else to take a shared task (idempotent). */
  async requestReassignment(taskId: string, reason: string, note = ''): Promise<ReassignmentRequest> {
    if (!config.useMocks) return apiRequest<ReassignmentRequest>('/reassignment-requests', { method: 'POST', body: { taskId, reason, note } });
    const task = db.tasks.find((t) => t.id === taskId && canSeeTask(t));
    if (!task) return notFound('That task');
    if (task.visibility === 'private') return fail('A private task can’t be handed over. Share it with the family first.', 422);
    const isNew = !openRequestFor(taskId);
    const request = ensureRequest(taskId, reason, note);
    if (isNew) {
      audit({ category: 'tasks', action: 'Asked for someone to take over', subject: task.title, after: reason });
      notify({ type: 'reassignment', message: `“${task.title}” needs someone else. Can you take it?`, href: `/priority/requests/${request.id}` });
    }
    persist();
    return respond(request);
  },

  async listRequests(): Promise<(ReassignmentRequest & { taskTitle: string; taskStart: string })[]> {
    if (!config.useMocks) return apiRequest<(ReassignmentRequest & { taskTitle: string; taskStart: string })[]>('/reassignment-requests');
    const list = db.reassignments
      .map((r) => {
        const task = db.tasks.find((t) => t.id === r.taskId);
        return { ...r, taskTitle: task?.title ?? 'Removed task', taskStart: task?.start ?? r.createdAt };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return respond(list);
  },

  async getRequest(id: string): Promise<RequestView> {
    if (!config.useMocks) return apiRequest<RequestView>(`/reassignment-requests/${id}`);
    const request = db.reassignments.find((r) => r.id === id);
    const task = request && db.tasks.find((t) => t.id === request.taskId);
    if (!request || !task) return notFound('That handover request');
    const d = engineData();
    // Score against the original assignee so they are excluded from candidates.
    const scored = scoreCandidates({ ...task, assigneeId: request.fromMemberId }, d);
    return respond({ request, task, candidates: scored, conflict: detectConflicts(d).find((c) => c.taskId === task.id) });
  },

  /** Hand the task to `memberId`. See `canApproveHandover` for who may do this. */
  async approveRequest(id: string, memberId: string): Promise<ReassignmentRequest> {
    if (!config.useMocks) return apiRequest<ReassignmentRequest>(`/reassignment-requests/${id}/approve`, { method: 'POST', body: { memberId } });
    const request = db.reassignments.find((r) => r.id === id);
    const task = request && db.tasks.find((t) => t.id === request.taskId);
    if (!request || !task) return notFound('That handover request');
    if (request.status !== 'open') return fail('This request has already been settled.', 409);
    if (!db.members.some((m) => m.id === memberId)) return notFound('That family member');
    if (!canApproveHandover(request, memberId, { id: actorId(), role: isLead() ? 'lead' : 'contributor' })) {
      return fail('Only the organiser, the person handing the task over, or the person taking it can confirm this.', 403);
    }

    task.assigneeId = memberId;
    task.acknowledgedConflict = undefined;
    if (task.appointmentId) {
      const appt = db.appointments.find((a) => a.id === task.appointmentId);
      if (appt && appt.forId !== memberId) appt.escortId = memberId;
    }
    request.status = 'approved';
    request.approvedMemberId = memberId;
    request.resolvedAt = nowIso();

    const line = request.fromMemberId ? `${firstName(memberId)} took over “${task.title}” from ${firstName(request.fromMemberId)}.` : `${firstName(memberId)} picked up “${task.title}”.`;
    audit({ category: 'tasks', action: 'Handed over a task', subject: task.title, before: memberName(request.fromMemberId), after: memberName(memberId) });
    notify({ type: 'reassignment', message: line, href: `/tasks/${task.id}` });
    postSystemMessage(line);
    persist();
    return respond(request);
  },

  async cancelRequest(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/reassignment-requests/${id}/cancel`, { method: 'POST' });
    const request = db.reassignments.find((r) => r.id === id);
    if (!request) return notFound('That handover request');
    request.status = 'cancelled';
    request.resolvedAt = nowIso();
    persist();
    return respond(undefined);
  },

  /** Keep the current plan even though a conflict was detected. */
  async acknowledgeConflict(taskId: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/decisions/tasks/${taskId}/acknowledge`, { method: 'POST' });
    const task = db.tasks.find((t) => t.id === taskId && canSeeTask(t));
    if (!task) return notFound('That task');
    const conflict = detectConflicts(engineData()).find((c) => c.taskId === taskId);
    if (conflict) {
      task.acknowledgedConflict = conflict.kind;
      if (task.visibility === 'family') audit({ category: 'tasks', action: 'Kept a task despite a clash', subject: task.title, after: conflict.reason });
      persist();
    }
    return respond(undefined);
  },

  /** What-if: evaluate a change without saving it. */
  async simulate(change: SimulationChange): Promise<SimulationResult> {
    if (!config.useMocks) return apiRequest<SimulationResult>('/decisions/simulations', { method: 'POST', body: change });
    if (!db.tasks.some((t) => t.id === change.taskId && canSeeTask(t))) return notFound('That task');
    return respond(simulate(change, engineData()));
  },

  /** Apply a simulated change to the live schedule. */
  async applySimulation(change: SimulationChange): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>('/decisions/simulations/apply', { method: 'POST', body: change });
    const task = db.tasks.find((t) => t.id === change.taskId && canSeeTask(t));
    if (!task) return notFound('That task');
    if (task.visibility === 'private' && change.assigneeId !== undefined && change.assigneeId !== task.assigneeId) return fail('A private task can’t be given to someone else.', 422);
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
    if (task.visibility === 'family') {
      audit({ category: 'schedule', action: 'Applied a what-if change', subject: task.title, before, after: `${memberName(task.assigneeId)} · ${task.start}` });
      notify({ type: 'task', message: `The plan for “${task.title}” was changed from the what-if planner.`, href: `/tasks/${task.id}` });
    }
    persist();
    return respond(task);
  },
};
