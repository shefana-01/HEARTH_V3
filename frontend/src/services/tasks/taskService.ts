/**
 * Tasks — task-service.
 *
 * A task is either shared with the family or private to one person. Private
 * tasks are only ever returned to their owner; they leave no trace in the
 * family's activity log or notifications.
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { actorId, audit, canSeeTask, db, fail, firstName, memberName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import { formatDayTime } from '@/lib/dates';
import type { Task, TaskInput } from '@/types/domain';

export interface TaskFilter {
  assigneeId?: string;
  includeCancelled?: boolean;
}

const byStart = (a: Task, b: Task) => a.start.localeCompare(b.start);

/** Only tasks the signed-in person may see. */
function find(id: string) {
  const task = db.tasks.find((t) => t.id === id);
  return task && canSeeTask(task) ? task : undefined;
}

/** A private task always belongs to the person who wrote it. */
function normalise(input: TaskInput): TaskInput {
  const base = { ...input, title: input.title.trim(), notes: input.notes.trim() };
  return input.visibility === 'private' ? { ...base, assigneeId: actorId() } : base;
}

const shared = (task: Task) => task.visibility === 'family';

export const taskService = {
  async listTasks(filter: TaskFilter = {}): Promise<Task[]> {
    if (!config.useMocks) return apiRequest<Task[]>(`/tasks${query({ assigneeId: filter.assigneeId, includeCancelled: filter.includeCancelled })}`);
    const list = db.tasks.filter((t) => canSeeTask(t) && (filter.includeCancelled || t.status !== 'cancelled') && (!filter.assigneeId || t.assigneeId === filter.assigneeId));
    return respond([...list].sort(byStart));
  },

  async getTask(id: string): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>(`/tasks/${id}`);
    const task = find(id);
    return task ? respond(task) : notFound('That task');
  },

  async createTask(input: TaskInput): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>('/tasks', { method: 'POST', body: input });
    requireFamily();
    const task: Task = { ...normalise(input), id: newId('t'), status: 'scheduled', createdById: actorId(), createdAt: nowIso() };
    db.tasks.push(task);
    if (shared(task)) {
      audit({ category: 'tasks', action: 'Created a task', subject: task.title, after: `${memberName(task.assigneeId)} · ${formatDayTime(task.start)}` });
      if (task.assigneeId && task.assigneeId !== actorId()) {
        notify({ type: 'task', forId: task.assigneeId, message: `${firstName(actorId())} asked you to do “${task.title}” (${formatDayTime(task.start)}).`, href: `/tasks/${task.id}` });
      }
    }
    persist();
    return respond(task);
  },

  async updateTask(id: string, input: TaskInput): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>(`/tasks/${id}`, { method: 'PUT', body: input });
    const task = find(id);
    if (!task) return notFound('That task');
    const before = `${memberName(task.assigneeId)} · ${formatDayTime(task.start)}`;
    const previousAssignee = task.assigneeId;
    Object.assign(task, normalise(input), { acknowledgedConflict: undefined });
    if (shared(task)) {
      audit({ category: 'tasks', action: 'Edited a task', subject: task.title, before, after: `${memberName(task.assigneeId)} · ${formatDayTime(task.start)}` });
      if (task.assigneeId && task.assigneeId !== previousAssignee && task.assigneeId !== actorId()) {
        notify({ type: 'task', forId: task.assigneeId, message: `${firstName(actorId())} asked you to do “${task.title}” (${formatDayTime(task.start)}).`, href: `/tasks/${task.id}` });
      }
    } else {
      // Made private: nobody else should be left holding a request for it.
      db.reassignments.forEach((r) => {
        if (r.taskId === id && r.status === 'open') r.status = 'cancelled';
      });
    }
    persist();
    return respond(task);
  },

  async completeTask(id: string): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>(`/tasks/${id}/complete`, { method: 'POST' });
    const task = find(id);
    if (!task) return notFound('That task');
    task.status = 'completed';
    task.completedAt = nowIso();
    task.completedById = actorId();
    if (shared(task)) audit({ category: 'tasks', action: 'Completed a task', subject: task.title });
    persist();
    return respond(task);
  },

  async reopenTask(id: string): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>(`/tasks/${id}/reopen`, { method: 'POST' });
    const task = find(id);
    if (!task) return notFound('That task');
    task.status = 'scheduled';
    task.completedAt = undefined;
    task.completedById = undefined;
    if (shared(task)) audit({ category: 'tasks', action: 'Reopened a task', subject: task.title });
    persist();
    return respond(task);
  },

  async cancelTask(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' });
    const task = find(id);
    if (!task) return notFound('That task');
    task.status = 'cancelled';
    db.reassignments.forEach((r) => {
      if (r.taskId === id && r.status === 'open') r.status = 'cancelled';
    });
    if (shared(task)) audit({ category: 'tasks', action: 'Cancelled a task', subject: task.title });
    persist();
    return respond(undefined);
  },

  /** Give a shared task to someone (or to nobody). Private tasks stay with their owner. */
  async assignTask(id: string, memberId: string | null): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>(`/tasks/${id}/assignee`, { method: 'PUT', body: { memberId } });
    const task = find(id);
    if (!task) return notFound('That task');
    if (!shared(task)) return fail('A private task can’t be given to someone else. Share it with the family first.', 422);
    const before = memberName(task.assigneeId);
    task.assigneeId = memberId;
    task.acknowledgedConflict = undefined;
    audit({ category: 'tasks', action: 'Handed over a task', subject: task.title, before, after: memberName(memberId) });
    if (memberId && memberId !== actorId()) {
      notify({ type: 'task', forId: memberId, message: `${firstName(actorId())} asked you to do “${task.title}” (${formatDayTime(task.start)}).`, href: `/tasks/${task.id}` });
    }
    persist();
    return respond(task);
  },
};
