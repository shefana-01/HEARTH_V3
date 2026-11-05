/**
 * Medicines and the emergency card — care-service.
 *
 * Who sees what follows health notes: your own always; someone else's with medical access (the organiser
 * always has it) — a dependant's always, a member's only if they share their health notes. The carer of a
 * medicine also sees it and can mark doses. Hearth reminds and records; it never advises on medicine.
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { actorId, audit, canSeeHealth, db, fail, isDependant, me, notFound, notify, nowIso, persist, personName, respond, firstName, newId } from '../mockStore';
import type { Dose, DoseStatus, EmergencyInfo, EmergencyInput, Medication, MedicationInput } from '@/types/domain';

/** A dose counts as due for an hour after its time; after that, unmarked means missed. */
export const GRACE_MIN = 60;
const DAY = 86_400_000;

/** Every dose time of `m` in [from, to] (local times of this device in demo mode). */
export function slotsOf(m: Pick<Medication, 'times' | 'days' | 'startDate' | 'endDate'>, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const [sy, sm, sd] = m.startDate.split('-').map(Number);
  const first = new Date(sy, sm - 1, sd);
  const last = m.endDate ? (([y, mo, d]) => new Date(y, mo - 1, d, 23, 59, 59))(m.endDate.split('-').map(Number)) : null;
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - 1);
  const times = [...m.times].sort();
  for (; day.getTime() <= to.getTime(); day.setDate(day.getDate() + 1)) {
    if (day < first || (last && day > last)) continue;
    const mondayBased = (day.getDay() + 6) % 7;
    if (!m.days[mondayBased]) continue;
    for (const t of times) {
      const [h, min] = t.split(':').map(Number);
      const slot = new Date(day);
      slot.setHours(h, min, 0, 0);
      if (slot >= from && slot <= to) out.push(slot);
    }
  }
  return out;
}

const canEdit = (personId: string) => {
  if (personId === actorId()) return true;
  const self = me();
  return isDependant(personId) && Boolean(self && (self.role === 'lead' || self.access.medical)) && self?.role !== 'observer';
};
const involves = (m: Medication, memberId = actorId()) => m.personId === memberId || m.carerId === memberId;
const visible = () => db.medications.filter((m) => involves(m) || canSeeHealth(m.personId));

function validate(input: MedicationInput): string | null {
  if (!input.name.trim()) return 'Give the medicine a name.';
  if (input.times.length === 0 || input.times.length > 6) return 'Add between one and six times a day.';
  if (input.times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return 'Times look like 08:00.';
  if (!input.days.some(Boolean)) return 'Choose at least one day.';
  if (input.endDate && input.endDate < input.startDate) return 'The last day can’t be before the first day.';
  if (input.reminders && isDependant(input.personId) && !input.carerId) return 'Choose who helps with it, so someone gets the reminders.';
  return null;
}

const normalise = (input: MedicationInput): MedicationInput => ({
  ...input,
  name: input.name.trim(),
  dose: input.dose.trim(),
  instructions: input.instructions.trim(),
  times: [...new Set(input.times)].sort(),
  endDate: input.endDate || undefined,
  carerId: input.carerId || undefined,
});

export const medicationService = {
  async list(personId?: string): Promise<Medication[]> {
    if (!config.useMocks) return apiRequest<Medication[]>(`/medications${query({ personId })}`);
    return respond(visible().filter((m) => !personId || m.personId === personId));
  },

  async create(input: MedicationInput): Promise<Medication> {
    if (!config.useMocks) return apiRequest<Medication>('/medications', { method: 'POST', body: input });
    if (!canEdit(input.personId)) return fail('You can add medicines for yourself, or for someone the family looks after if you have medical access.', 403);
    const problem = validate(input);
    if (problem) return fail(problem, 422);
    const med: Medication = { ...normalise(input), id: newId('med'), createdById: actorId(), updatedAt: nowIso() };
    db.medications.push(med);
    if (isDependant(med.personId)) audit({ category: 'care', action: 'Added a medicine schedule', subject: personName(med.personId) });
    if (med.carerId && med.carerId !== actorId()) {
      notify({
        type: 'reminder',
        forId: med.carerId,
        message: `${firstName(actorId())} asked you to help ${personName(med.personId).split(' ')[0]} with ${med.name} at ${med.times.join(', ')}.`,
        href: '/health/medicines',
      });
    }
    persist();
    return respond(med);
  },

  async update(id: string, input: MedicationInput): Promise<Medication> {
    if (!config.useMocks) return apiRequest<Medication>(`/medications/${id}`, { method: 'PUT', body: input });
    const med = visible().find((m) => m.id === id);
    if (!med) return notFound('That medicine');
    if (!canEdit(med.personId)) return fail('You can view this medicine but not change it.', 403);
    if (input.personId !== med.personId) return fail('A medicine stays with the person who takes it. Add a new one for someone else.', 422);
    const problem = validate(input);
    if (problem) return fail(problem, 422);
    Object.assign(med, normalise(input), { updatedAt: nowIso() });
    if (isDependant(med.personId)) audit({ category: 'care', action: 'Changed a medicine schedule', subject: personName(med.personId) });
    persist();
    return respond(med);
  },

  async remove(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/medications/${id}`, { method: 'DELETE' });
    const med = visible().find((m) => m.id === id);
    if (!med) return notFound('That medicine');
    if (!canEdit(med.personId)) return fail('You can view this medicine but not change it.', 403);
    db.medications = db.medications.filter((m) => m.id !== id);
    db.doses = db.doses.filter((d) => d.medicationId !== id);
    if (isDependant(med.personId)) audit({ category: 'care', action: 'Removed a medicine schedule', subject: personName(med.personId) });
    persist();
    return respond(undefined);
  },

  /** Scheduled doses in [from, to] and what happened to each, earliest first. */
  async doses(from: Date, to: Date, personId?: string): Promise<Dose[]> {
    if (!config.useMocks) return apiRequest<Dose[]>(`/medications/doses${query({ from: from.toISOString(), to: to.toISOString(), personId })}`);
    const now = Date.now();
    const out: Dose[] = [];
    for (const m of visible().filter((x) => !personId || x.personId === personId)) {
      for (const slot of slotsOf(m, from, to)) {
        const iso = slot.toISOString();
        const recorded = db.doses.find((d) => d.medicationId === m.id && d.scheduledAt === iso);
        if (!recorded && !m.active) continue;
        const status: DoseStatus = recorded ? recorded.status : slot.getTime() > now ? 'upcoming' : slot.getTime() + GRACE_MIN * 60_000 > now ? 'due' : 'missed';
        out.push({
          medicationId: m.id,
          personId: m.personId,
          name: m.name,
          dose: m.dose,
          instructions: m.instructions,
          scheduledAt: iso,
          status,
          recordedById: recorded?.recordedById,
          recordedAt: recorded?.recordedAt,
        });
      }
    }
    return respond(out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.name.localeCompare(b.name)));
  },

  async record(medicationId: string, scheduledAt: string, status: 'taken' | 'skipped'): Promise<Dose> {
    if (!config.useMocks) return apiRequest<Dose>(`/medications/${medicationId}/doses`, { method: 'POST', body: { scheduledAt, status } });
    const med = visible().find((m) => m.id === medicationId);
    if (!med) return notFound('That medicine');
    const self = me();
    if (med.personId !== actorId() && (self?.role === 'observer' || (!canEdit(med.personId) && !involves(med)))) return fail('You can view this medicine but not mark doses.', 403);
    const at = new Date(scheduledAt);
    if (!slotsOf(med, at, at).some((s) => s.getTime() === at.getTime())) return fail('No dose of this medicine is planned at that time.', 422);
    if (at.getTime() > Date.now() + 2 * 3_600_000 || at.getTime() < Date.now() - 7 * DAY) return fail('Doses can be marked from two hours before until a week after their time.', 422);
    const iso = at.toISOString();
    const existing = db.doses.find((d) => d.medicationId === medicationId && d.scheduledAt === iso);
    const recordedAt = nowIso();
    if (existing) Object.assign(existing, { status, recordedById: actorId(), recordedAt });
    else db.doses.push({ medicationId, scheduledAt: iso, status, recordedById: actorId(), recordedAt });
    persist();
    return respond({ medicationId, personId: med.personId, name: med.name, dose: med.dose, instructions: med.instructions, scheduledAt: iso, status, recordedById: actorId(), recordedAt });
  },

  async getEmergency(personId: string): Promise<EmergencyInfo> {
    if (!config.useMocks) return apiRequest<EmergencyInfo>(`/health/emergency/${personId}`);
    if (!canSeeHealth(personId) && !canEdit(personId)) return fail('This person keeps their health details private.', 403);
    return respond(db.emergency.find((e) => e.personId === personId) ?? { personId, bloodGroup: '', allergies: '', doctorName: '', doctorPhone: '', hospital: '', notes: '' });
  },

  async saveEmergency(personId: string, input: EmergencyInput): Promise<EmergencyInfo> {
    if (!config.useMocks) return apiRequest<EmergencyInfo>(`/health/emergency/${personId}`, { method: 'PUT', body: input });
    if (!canEdit(personId)) return fail('You can only change your own emergency card, or that of someone the family looks after.', 403);
    if (input.doctorPhone && !/^[+0-9 ()-]{5,30}$/.test(input.doctorPhone)) return fail('Enter the doctor’s phone number with digits only.', 422);
    const row: EmergencyInfo = { personId, ...Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v ?? '').trim()])), updatedAt: nowIso() } as EmergencyInfo;
    db.emergency = [...db.emergency.filter((e) => e.personId !== personId), row];
    if (isDependant(personId)) audit({ category: 'care', action: 'Updated the emergency card', subject: personName(personId) });
    persist();
    return respond(row);
  },

  /** Whether the signed-in person may change medicines and the emergency card for `personId`. */
  canEdit: (personId: string, ctx: { meId?: string; isObserver: boolean; canSeeMedical: boolean; isDependant: boolean }) =>
    personId === ctx.meId || (ctx.isDependant && ctx.canSeeMedical && !ctx.isObserver),
};
