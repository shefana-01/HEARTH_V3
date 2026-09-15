/**
 * Family schedule, availability and unavailability —
 * task-service (schedule) and family-service (availability).
 * REST contract: not defined yet.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, fail, firstName, newId, notify, nowIso, persist, respond } from '../mockStore';
import { detectConflicts, taskEnd } from '../decision/engine';
import { formatDayTime, weekDays } from '@/lib/dates';
import type { ReassignmentRequest, ScheduleEvent, Unavailability, WeeklyAvailability } from '@/types/domain';

export interface UnavailabilityInput {
  start: string;
  end: string;
  reason: string;
  note: string;
}

export interface UnavailabilityResult {
  unavailability: Unavailability;
  affectedTaskIds: string[];
  requestIds: string[];
}

const MIN = 60_000;

export const scheduleService = {
  /** Tasks, appointments and absences in the Monday-based week around `reference`. */
  async getWeek(reference: Date): Promise<ScheduleEvent[]> {
    if (!config.useMocks) return backendNotConnected('task-service', 'getWeekSchedule');
    const days = weekDays(reference);
    const from = days[0].getTime();
    const to = days[6].getTime() + 86_400_000;
    const inRange = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= from && t < to;
    };
    const conflicted = new Set(
      detectConflicts({ tasks: db.tasks, appointments: db.appointments, members: db.members, unavailability: db.unavailability }).map((c) => c.taskId),
    );

    const events: ScheduleEvent[] = [
      ...db.tasks
        .filter((t) => t.status !== 'cancelled' && inRange(t.start))
        .map<ScheduleEvent>((t) => ({
          id: t.id,
          kind: t.status === 'completed' ? 'completed' : conflicted.has(t.id) ? 'conflict' : 'task',
          title: t.title,
          subtitle: t.assigneeId ? firstName(t.assigneeId) : 'Unassigned',
          start: t.start,
          end: new Date(taskEnd(t)).toISOString(),
          memberId: t.assigneeId,
          href: `/tasks/${t.id}`,
        })),
      ...db.appointments
        .filter((a) => inRange(a.start))
        .map<ScheduleEvent>((a) => ({
          id: a.id,
          kind: 'appointment',
          title: a.title,
          subtitle: a.provider,
          start: a.start,
          end: new Date(new Date(a.start).getTime() + a.durationMin * MIN).toISOString(),
          memberId: a.escortId,
          href: `/appointments/${a.id}`,
        })),
      ...db.unavailability
        .filter((u) => inRange(u.start))
        .map<ScheduleEvent>((u) => ({
          id: u.id,
          kind: 'unavailable',
          title: `${firstName(u.memberId)} unavailable`,
          subtitle: u.reason || undefined,
          start: u.start,
          end: u.end,
          memberId: u.memberId,
        })),
    ];
    return respond(events.sort((a, b) => a.start.localeCompare(b.start)));
  },

  async getAvailability(memberId: string): Promise<WeeklyAvailability> {
    if (!config.useMocks) return backendNotConnected('family-service', 'getAvailability');
    const member = db.members.find((m) => m.id === memberId);
    return member ? respond(member.availability) : fail('That family member could not be found.', 404);
  },

  async saveAvailability(memberId: string, availability: WeeklyAvailability): Promise<WeeklyAvailability> {
    if (!config.useMocks) return backendNotConnected('family-service', 'saveAvailability');
    const member = db.members.find((m) => m.id === memberId);
    if (!member) return fail('That family member could not be found.', 404);
    member.availability = availability;
    audit({ category: 'schedule', action: 'Updated weekly availability', subject: member.name, after: `${availability.windows.length} time window(s)` });
    persist();
    return respond(member.availability);
  },

  async listUnavailability(memberId?: string): Promise<Unavailability[]> {
    if (!config.useMocks) return backendNotConnected('family-service', 'listUnavailability');
    return respond(db.unavailability.filter((u) => !memberId || u.memberId === memberId));
  },

  async removeUnavailability(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('family-service', 'removeUnavailability');
    db.unavailability = db.unavailability.filter((u) => u.id !== id);
    persist();
    return respond(undefined);
  },

  /**
   * Report time the signed-in member can't cover. Every scheduled task of
   * theirs in that range gets an open reassignment request.
   */
  async reportUnavailability(input: UnavailabilityInput): Promise<UnavailabilityResult> {
    if (!config.useMocks) return backendNotConnected('task-service', 'reportUnavailability');
    const memberId = actorId();
    const start = new Date(input.start).getTime();
    const end = new Date(input.end).getTime();
    if (!(end > start)) return fail('The end time must be after the start time.', 422);

    const unavailability: Unavailability = { id: newId('u'), memberId, start: input.start, end: input.end, reason: input.reason, note: input.note.trim(), createdAt: nowIso() };
    db.unavailability.push(unavailability);

    const affected = db.tasks.filter(
      (t) => t.assigneeId === memberId && t.status === 'scheduled' && new Date(t.start).getTime() < end && taskEnd(t) > start,
    );
    const requestIds = affected.map((task) => {
      const existing = db.reassignments.find((r) => r.taskId === task.id && r.status === 'open');
      if (existing) return existing.id;
      const request: ReassignmentRequest = {
        id: newId('rq'),
        taskId: task.id,
        fromMemberId: memberId,
        reason: input.reason ? `${firstName(memberId)} is unavailable (${input.reason.toLowerCase()}).` : `${firstName(memberId)} is unavailable.`,
        note: input.note.trim(),
        createdAt: nowIso(),
        createdById: memberId,
        status: 'open',
      };
      db.reassignments.push(request);
      return request.id;
    });

    audit({ category: 'schedule', action: 'Reported unavailability', subject: `${formatDayTime(input.start)} – ${formatDayTime(input.end)}`, after: input.reason || undefined });
    notify({
      type: 'availability',
      message: `${firstName(memberId)} reported being unavailable${affected.length ? ` — ${affected.length} task(s) need a new caregiver` : ''}.`,
      href: '/priority',
    });
    persist();
    return respond({ unavailability, affectedTaskIds: affected.map((t) => t.id), requestIds });
  },
};
