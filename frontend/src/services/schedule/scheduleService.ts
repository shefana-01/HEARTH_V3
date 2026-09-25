/**
 * The week view, weekly availability and time away —
 * decision-service (week), family-service (availability) and task-service (time away).
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { actorId, audit, canSeeAppointment, canSeeTask, db, engineData, fail, firstName, newId, notify, nowIso, persist, personName, respond } from '../mockStore';
import { detectConflicts, taskEnd } from '../decision/engine';
import { expandEvents } from '@/lib/recurrence';
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
  /** Shared tasks that now need someone else. */
  affectedTaskIds: string[];
  /** Handover requests opened for them. */
  requestIds: string[];
  /** Private tasks in the same time: only their owner can move those. */
  personalTaskIds: string[];
}

const MIN = 60_000;

function weekFromApi(reference: Date): Promise<ScheduleEvent[]> {
  const days = weekDays(reference);
  return apiRequest<ScheduleEvent[]>(`/schedule/events${query({ from: days[0].toISOString(), to: new Date(days[6].getTime() + 86_400_000).toISOString() })}`);
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * The API saves the time away and publishes an event; the decision service
 * then opens a handover request per affected task. That takes a moment,
 * so wait briefly (up to ~3 s) for the requests before answering.
 */
async function reportToApi(input: UnavailabilityInput): Promise<UnavailabilityResult> {
  const result = await apiRequest<UnavailabilityResult>('/unavailability', { method: 'POST', body: input });
  const affected = new Set(result.affectedTaskIds);
  let requestIds: string[] = [];
  for (let attempt = 0; affected.size > 0 && attempt < 8 && requestIds.length < affected.size; attempt++) {
    await wait(400);
    const requests = await apiRequest<ReassignmentRequest[]>('/reassignment-requests').catch(() => []);
    requestIds = requests.filter((r) => r.status === 'open' && affected.has(r.taskId)).map((r) => r.id);
  }
  return { ...result, requestIds };
}

export const scheduleService = {
  /**
   * Everything in the Monday-based week around `reference`: tasks, appointments,
   * personal events and time away. Other people's private items come back as
   * plain "Busy" blocks.
   */
  async getWeek(reference: Date): Promise<ScheduleEvent[]> {
    if (!config.useMocks) return weekFromApi(reference);
    const days = weekDays(reference);
    const from = days[0].getTime();
    const to = days[6].getTime() + 86_400_000;
    const inRange = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= from && t < to;
    };
    const me = actorId();
    const conflicted = new Set(detectConflicts(engineData()).map((c) => c.taskId));
    const busy = (id: string, memberId: string | null, start: string, end: string): ScheduleEvent => ({ id, kind: 'busy', title: 'Busy', start, end, memberId });

    const events: ScheduleEvent[] = [
      ...db.tasks
        .filter((t) => t.status !== 'cancelled' && inRange(t.start))
        .map<ScheduleEvent>((t) => {
          const end = new Date(taskEnd(t)).toISOString();
          if (!canSeeTask(t)) return busy(t.id, t.assigneeId, t.start, end);
          return {
            id: t.id,
            kind: t.status === 'completed' ? 'completed' : conflicted.has(t.id) ? 'conflict' : 'task',
            title: t.title,
            subtitle: t.visibility === 'private' ? 'Private' : t.assigneeId ? firstName(t.assigneeId) : 'Needs someone',
            start: t.start,
            end,
            memberId: t.assigneeId,
            href: `/tasks/${t.id}`,
          };
        }),
      ...db.appointments
        .filter((a) => inRange(a.start))
        .map<ScheduleEvent>((a) => {
          const end = new Date(new Date(a.start).getTime() + a.durationMin * MIN).toISOString();
          const attendee = db.members.some((m) => m.id === a.forId) ? a.forId : null;
          const memberId = attendee ?? a.escortId;
          if (!canSeeAppointment(a)) return busy(a.id, memberId, a.start, end);
          return {
            id: a.id,
            kind: 'appointment',
            title: a.title,
            subtitle: `For ${personName(a.forId).split(' ')[0]}${a.provider ? ` · ${a.provider}` : ''}`,
            start: a.start,
            end,
            memberId,
            alsoMemberId: attendee && a.escortId && a.escortId !== attendee ? a.escortId : undefined,
            href: `/appointments/${a.id}`,
          };
        }),
      ...expandEvents(db.events, from, to).map<ScheduleEvent>((b) =>
        b.hidden && b.memberId !== me
          ? busy(b.id, b.memberId, b.start, b.end)
          : {
              id: b.id,
              kind: 'event',
              title: b.label,
              subtitle: firstName(b.memberId),
              start: b.start,
              end: b.end,
              memberId: b.memberId,
              href: b.memberId === me ? `/schedule/events/${b.eventId}` : undefined,
            },
      ),
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
    return respond(events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)));
  },

  async getAvailability(memberId: string): Promise<WeeklyAvailability> {
    if (!config.useMocks) return apiRequest<WeeklyAvailability>(`/members/${memberId}/availability`);
    const member = db.members.find((m) => m.id === memberId);
    return member ? respond(member.availability) : fail('That family member could not be found.', 404);
  },

  async saveAvailability(memberId: string, availability: WeeklyAvailability): Promise<WeeklyAvailability> {
    if (!config.useMocks) return apiRequest<WeeklyAvailability>(`/members/${memberId}/availability`, { method: 'PUT', body: availability });
    const member = db.members.find((m) => m.id === memberId);
    if (!member) return fail('That family member could not be found.', 404);
    member.availability = availability;
    audit({ category: 'schedule', action: 'Updated weekly availability', subject: member.name, after: `${availability.windows.length} time window(s)` });
    persist();
    return respond(member.availability);
  },

  async listUnavailability(memberId?: string): Promise<Unavailability[]> {
    if (!config.useMocks) return apiRequest<Unavailability[]>(`/unavailability${query({ memberId })}`);
    return respond(db.unavailability.filter((u) => !memberId || u.memberId === memberId));
  },

  async removeUnavailability(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/unavailability/${id}`, { method: 'DELETE' });
    db.unavailability = db.unavailability.filter((u) => u.id !== id);
    persist();
    return respond(undefined);
  },

  /**
   * Tell the family about time the signed-in person can't cover. Every shared
   * task of theirs in that range gets an open handover request.
   */
  async reportUnavailability(input: UnavailabilityInput): Promise<UnavailabilityResult> {
    if (!config.useMocks) return reportToApi(input);
    const memberId = actorId();
    const start = new Date(input.start).getTime();
    const end = new Date(input.end).getTime();
    if (!(end > start)) return fail('The end time must be after the start time.', 422);

    const unavailability: Unavailability = { id: newId('u'), memberId, start: input.start, end: input.end, reason: input.reason, note: input.note.trim(), createdAt: nowIso() };
    db.unavailability.push(unavailability);

    const inWindow = db.tasks.filter((t) => t.assigneeId === memberId && t.status === 'scheduled' && new Date(t.start).getTime() < end && taskEnd(t) > start);
    const affected = inWindow.filter((t) => t.visibility === 'family');
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

    audit({ category: 'schedule', action: 'Reported time away', subject: `${formatDayTime(input.start)} – ${formatDayTime(input.end)}`, after: input.reason || undefined });
    notify({
      type: 'availability',
      message: `${firstName(memberId)} can’t make it ${formatDayTime(input.start)} – ${formatDayTime(input.end)}${affected.length ? ` — ${affected.length} task${affected.length === 1 ? ' needs' : 's need'} someone else` : ''}.`,
      href: '/priority',
    });
    persist();
    return respond({ unavailability, affectedTaskIds: affected.map((t) => t.id), requestIds, personalTaskIds: inWindow.filter((t) => t.visibility === 'private').map((t) => t.id) });
  },
};
