/**
 * Appointments — care-service.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, firstName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import { formatDayTime } from '@/lib/dates';
import type { Appointment, AppointmentInput } from '@/types/domain';

const find = (id: string) => db.appointments.find((a) => a.id === id);

export const appointmentService = {
  async list(): Promise<Appointment[]> {
    if (!config.useMocks) return apiRequest<Appointment[]>('/appointments');
    return respond([...db.appointments].sort((a, b) => a.start.localeCompare(b.start)));
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
      createdAt: nowIso(),
      prep: input.prep.filter((p) => p.trim()).map((label) => ({ id: newId('p'), label: label.trim(), done: false })),
    };
    db.appointments.push(appt);
    audit({ category: 'care', action: 'Added an appointment', subject: appt.title, after: formatDayTime(appt.start) });
    if (appt.escortId && appt.escortId !== actorId()) {
      notify({ type: 'appointment', message: `${firstName(appt.escortId)} was asked to accompany “${appt.title}” on ${formatDayTime(appt.start)}.`, href: `/appointments/${appt.id}` });
    }
    persist();
    return respond(appt);
  },

  async update(id: string, input: Omit<AppointmentInput, 'prep'>): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}`, { method: 'PUT', body: input });
    const appt = find(id);
    if (!appt) return notFound('That appointment');
    Object.assign(appt, input);
    db.tasks.forEach((t) => {
      if (t.appointmentId === id && t.status === 'scheduled') t.assigneeId = appt.escortId;
    });
    audit({ category: 'care', action: 'Edited an appointment', subject: appt.title });
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
    audit({ category: 'care', action: 'Removed an appointment', subject: appt.title });
    persist();
    return respond(undefined);
  },

  async togglePrep(id: string, prepId: string): Promise<Appointment> {
    if (!config.useMocks) return apiRequest<Appointment>(`/appointments/${id}/prep/${prepId}/toggle`, { method: 'POST' });
    const appt = find(id);
    const item = appt?.prep.find((p) => p.id === prepId);
    if (!appt || !item) return notFound('That preparation item');
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
