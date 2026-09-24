/**
 * Appointments — care-service.
 *
 * An appointment is for one person (a member or someone the family looks
 * after) and may have a member going along. A private appointment is only
 * visible to the people involved; everyone else sees that time as busy.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, audit, canSeeAppointment, db, firstName, newId, notFound, notify, nowIso, persist, personName, requireFamily, respond } from '../mockStore';
import { formatDayTime } from '@/lib/dates';
import type { Appointment, AppointmentInput } from '@/types/domain';

const find = (id: string) => {
  const appt = db.appointments.find((a) => a.id === id);
  return appt && canSeeAppointment(appt) ? appt : undefined;
};

const shared = (a: Appointment) => a.visibility === 'family';

function askEscort(appt: Appointment) {
  if (appt.escortId && appt.escortId !== actorId()) {
    notify({
      type: 'appointment',
      forId: appt.escortId,
      message: `${firstName(actorId())} asked you to go along to “${appt.title}” with ${personName(appt.forId).split(' ')[0]} (${formatDayTime(appt.start)}).`,
      href: `/appointments/${appt.id}`,
    });
  }
}

export const appointmentService = {
  async list(): Promise<Appointment[]> {
    if (!config.useMocks) return apiRequest<Appointment[]>('/appointments');
    return respond(db.appointments.filter((a) => canSeeAppointment(a)).sort((a, b) => a.start.localeCompare(b.start)));
  },

  async get(id: string): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}`);
    const appt = find(id);
    return appt ? respond(appt) : notFound('That appointment');
  },

  async create(input: AppointmentInput): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>('/appointments', { method: 'POST', body: input });
    requireFamily();
    const appt: Appointment = {
      ...input,
      title: input.title.trim(),
      id: newId('a'),
      createdById: actorId(),
      createdAt: nowIso(),
      prep: input.prep.filter((p) => p.trim()).map((label) => ({ id: newId('p'), label: label.trim(), done: false })),
    };
    db.appointments.push(appt);
    if (shared(appt)) audit({ category: 'care', action: 'Added an appointment', subject: appt.title, after: `${personName(appt.forId)} · ${formatDayTime(appt.start)}` });
    askEscort(appt);
    persist();
    return respond(appt);
  },

  async update(id: string, input: Omit<AppointmentInput, 'prep'>): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}`, { method: 'PUT', body: input });
    const appt = find(id);
    if (!appt) return notFound('That appointment');
    const previousEscort = appt.escortId;
    Object.assign(appt, input, { title: input.title.trim() });
    // A task linked to the visit ("drive to the clinic") follows whoever is going along.
    db.tasks.forEach((t) => {
      if (t.appointmentId === id && t.status === 'scheduled' && t.visibility === 'family' && appt.escortId) t.assigneeId = appt.escortId;
    });
    if (shared(appt)) audit({ category: 'care', action: 'Edited an appointment', subject: appt.title });
    if (appt.escortId !== previousEscort) askEscort(appt);
    persist();
    return respond(appt);
  },

  async remove(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/appointments/${id}`, { method: 'DELETE' });
    const appt = find(id);
    if (!appt) return notFound('That appointment');
    db.appointments = db.appointments.filter((a) => a.id !== id);
    db.tasks.forEach((t) => {
      if (t.appointmentId === id) t.appointmentId = undefined;
    });
    db.documents.forEach((d) => {
      if (d.appointmentId === id) d.appointmentId = undefined;
    });
    if (shared(appt)) audit({ category: 'care', action: 'Removed an appointment', subject: appt.title });
    persist();
    return respond(undefined);
  },

  async togglePrep(id: string, prepId: string): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}/prep/${prepId}/toggle`, { method: 'POST' });
    const appt = find(id);
    const item = appt?.prep.find((p) => p.id === prepId);
    if (!appt || !item) return notFound('That item');
    item.done = !item.done;
    item.doneById = item.done ? actorId() : undefined;
    persist();
    return respond(appt);
  },

  async addPrep(id: string, label: string): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}/prep`, { method: 'POST', body: { label } });
    const appt = find(id);
    if (!appt) return notFound('That appointment');
    appt.prep.push({ id: newId('p'), label: label.trim(), done: false });
    persist();
    return respond(appt);
  },

  async removePrep(id: string, prepId: string): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}/prep/${prepId}`, { method: 'DELETE' });
    const appt = find(id);
    if (!appt) return notFound('That appointment');
    appt.prep = appt.prep.filter((p) => p.id !== prepId);
    persist();
    return respond(appt);
  },
};
