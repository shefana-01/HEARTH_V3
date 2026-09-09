/**
 * Care tasks — task-service. REST contract: not defined yet.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, firstName, memberName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import { formatDayTime } from '@/lib/dates';
import type { CareTask, TaskInput } from '@/types/domain';

export interface TaskFilter {
  assigneeId?: string;
  includeCancelled?: boolean;
}

const byStart = (a: CareTask, b: CareTask) => a.start.localeCompare(b.start);

function find(id: string) {
  return db.tasks.find((t) => t.id === id);
}

export const taskService = {
  async listTasks(filter: TaskFilter = {}): Promise<CareTask[]> {
    if (!config.useMocks) return backendNotConnected('task-service', 'listTasks');
    const list = db.tasks.filter(
      (t) => (filter.includeCancelled || t.status !== 'cancelled') && (!filter.assigneeId || t.assigneeId === filter.assigneeId),
    );
    return respond([...list].sort(byStart));
  },

  async getTask(id: string): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('task-service', 'getTask');
    const task = find(id);
    return task ? respond(task) : notFound('That task');
  },

  async createTask(input: TaskInput): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('task-service', 'createTask');
    requireFamily();
    const task: CareTask = {
      ...input,
      id: newId('t'),
      title: input.title.trim(),
      notes: input.notes.trim(),
      status: 'scheduled',
      createdById: actorId(),
      createdAt: nowIso(),
    };
    db.tasks.push(task);
    audit({ category: 'tasks', action: 'Created a task', subject: task.title, after: `${memberName(task.assigneeId)} · ${formatDayTime(task.start)}` });
    if (task.assigneeId && task.assigneeId !== actorId()) {
      notify({ type: 'task', message: `“${task.title}” was assigned to ${firstName(task.assigneeId)}.`, href: `/tasks/${task.id}` });
    }
    persist();
    return respond(task);
  },

  async updateTask(id: string, input: TaskInput): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('task-service', 'updateTask');
    const task = find(id);
    if (!task) return notFound('That task');
    const before = `${memberName(task.assigneeId)} · ${formatDayTime(task.start)}`;
    Object.assign(task, input, { title: input.title.trim(), notes: input.notes.trim(), acknowledgedConflict: undefined });
    audit({ category: 'tasks', action: 'Edited a task', subject: task.title, before, after: `${memberName(task.assigneeId)} · ${formatDayTime(task.start)}` });
    persist();
    return respond(task);
  },

  async completeTask(id: string): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('task-service', 'completeTask');
    const task = find(id);
    if (!task) return notFound('That task');
    task.status = 'completed';
    task.completedAt = nowIso();
    task.completedById = actorId();
    audit({ category: 'tasks', action: 'Completed a task', subject: task.title });
    persist();
    return respond(task);
  },

  async reopenTask(id: string): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('task-service', 'reopenTask');
    const task = find(id);
    if (!task) return notFound('That task');
    task.status = 'scheduled';
    task.completedAt = undefined;
    task.completedById = undefined;
    audit({ category: 'tasks', action: 'Reopened a task', subject: task.title });
    persist();
    return respond(task);
  },

  async cancelTask(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('task-service', 'cancelTask');
    const task = find(id);
    if (!task) return notFound('That task');
    task.status = 'cancelled';
    db.reassignments.forEach((r) => {
      if (r.taskId === id && r.status === 'open') r.status = 'cancelled';
    });
    audit({ category: 'tasks', action: 'Cancelled a task', subject: task.title });
    persist();
    return respond(undefined);
  },

  async assignTask(id: string, memberId: string | null): Promise<CareTask> {
    if (!config.useMocks) return backendNotConnected('task-service', 'assignTask');
    const task = find(id);
    if (!task) return notFound('That task');
    const before = memberName(task.assigneeId);
    task.assigneeId = memberId;
    task.acknowledgedConflict = undefined;
    audit({ category: 'tasks', action: 'Reassigned a task', subject: task.title, before, after: memberName(memberId) });
    if (memberId && memberId !== actorId()) {
      notify({ type: 'task', message: `${firstName(memberId)} is now responsible for “${task.title}”.`, href: `/tasks/${task.id}` });
    }
    persist();
    return respond(task);
  },
};
