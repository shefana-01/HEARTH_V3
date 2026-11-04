import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { HeartPulse, Pencil, Phone, Printer, Share2, ShieldAlert } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { healthService } from '@/services/care/healthService';
import { medicationService } from '@/services/care/medicationService';
import { conditionById } from '@/constants/conditions';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { Button, Dialog, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, Select, Textarea, useToast } from '@/components/ui';
import type { EmergencyInput } from '@/types/domain';
import { scheduleText } from './medicineText';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * One page with what a paramedic, a neighbour or a new carer needs: allergies, conditions, medicines,
 * doctor, and who to call. Prints on one A4 page or saves as a PDF; can be shared from the phone.
 */
export default function EmergencyCardPage() {
  const { personId = '' } = useParams();
  const { people, members, me, family, canSeeMedical } = useFamily();
  const { toast } = useToast();
  const person = people.find((p) => p.id === personId);
  const dependant = family?.dependants.find((d) => d.id === personId);
  const [editing, setEditing] = useState(false);
  useDocumentTitle(person ? `Emergency card · ${person.name}` : 'Emergency card');

  const data = useAsync(async () => {
    const [info, profile, meds] = await Promise.all([
      medicationService.getEmergency(personId),
      healthService.getProfile(personId).catch(() => undefined),
      medicationService.list(personId).catch(() => []),
    ]);
    return { info, profile, meds: meds.filter((m) => m.active) };
  }, [personId]);
  useLiveRefresh(['care', 'family'], data.reload);

  const canEdit = personId === me?.id || (Boolean(dependant) && canSeeMedical && me?.role !== 'observer');
  const lead = members.find((m) => m.role === 'lead');
  const contacts = [...(lead && lead.id !== personId ? [lead] : []), ...members.filter((m) => m.id !== personId && m.id !== lead?.id && m.phone && data.data?.meds.some((x) => x.carerId === m.id))];

  if (data.status === 'error') return <ErrorState message={data.error?.message} onRetry={data.reload} />;
  if (!data.data || !person) return <PageSkeleton />;
  const { info, profile, meds } = data.data;
  const conditions = (profile?.conditions ?? []).map((id) => conditionById(id)?.label ?? id);

  const summary = [
    `EMERGENCY CARD — ${person.name}${dependant?.birthYear ? ` (born ${dependant.birthYear})` : ''}`,
    info.bloodGroup && `Blood group: ${info.bloodGroup}`,
    `Allergies: ${info.allergies || 'none known'}`,
    conditions.length > 0 && `Conditions: ${conditions.join(', ')}`,
    meds.length > 0 && `Medicines: ${meds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''} (${scheduleText(m)})`).join('; ')}`,
    info.doctorName && `Doctor: ${info.doctorName}${info.doctorPhone ? `, ${info.doctorPhone}` : ''}`,
    info.hospital && `Hospital: ${info.hospital}`,
    info.notes && `Notes: ${info.notes}`,
    ...contacts.map((c) => `Call: ${c.name}${c.phone ? `, ${c.phone}` : ''}`),
  ]
    .filter(Boolean)
    .join('\n');

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `Emergency card — ${person.name}`, text: summary });
      else {
        await navigator.clipboard.writeText(summary);
        toast({ title: 'Copied', description: 'Paste it into a message.' });
      }
    } catch {
      // cancelled
    }
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Emergency card"
          title={person.name}
          description="Keep a printed copy by the door or in a wallet, and share it with anyone who looks after them."
          actions={
            <>
              {canEdit && (
                <Button variant="secondary" onClick={() => setEditing(true)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                  Edit
                </Button>
              )}
              <Button variant="secondary" onClick={() => void share()} leftIcon={<Share2 aria-hidden="true" className="h-4 w-4" />}>
                Share
              </Button>
              <Button onClick={() => window.print()} leftIcon={<Printer aria-hidden="true" className="h-4 w-4" />}>
                Print or save PDF
              </Button>
            </>
          }
        />
      </div>

      <article
        aria-label={`Emergency card for ${person.name}`}
        className="emergency-card mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-surface p-6 shadow-card print:max-w-none print:rounded-none print:border-red-600 print:shadow-none"
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-red-100 pb-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
              <ShieldAlert aria-hidden="true" className="h-4 w-4" /> Emergency card
            </p>
            <h2 className="mt-1 font-display text-3xl text-ink">{person.name}</h2>
            <p className="text-sm text-ink-muted">{[person.relation || dependant?.relation, dependant?.birthYear && `born ${dependant.birthYear}`].filter(Boolean).join(' · ')}</p>
          </div>
          {info.bloodGroup && (
            <div className="rounded-xl bg-red-50 px-4 py-2 text-center">
              <p className="text-[0.6875rem] font-bold uppercase text-red-700">Blood</p>
              <p className="font-display text-2xl text-red-800">{info.bloodGroup}</p>
            </div>
          )}
        </header>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="font-bold uppercase tracking-wide text-red-700">Allergies</dt>
            <dd className="mt-0.5 text-base text-ink">{info.allergies || 'None known'}</dd>
          </div>
          {conditions.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="font-bold uppercase tracking-wide text-ink-muted">Conditions</dt>
              <dd className="mt-0.5 text-ink">{conditions.join(', ')}</dd>
            </div>
          )}
          {(dependant?.notes || info.notes) && (
            <div className="sm:col-span-2">
              <dt className="font-bold uppercase tracking-wide text-ink-muted">Good to know</dt>
              <dd className="mt-0.5 whitespace-pre-line text-ink">{[info.notes, dependant?.notes].filter(Boolean).join('\n')}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="font-bold uppercase tracking-wide text-ink-muted">Medicines</dt>
            <dd className="mt-0.5">
              {meds.length === 0 ? (
                <span className="text-ink">None recorded in Hearth</span>
              ) : (
                <ul className="space-y-1 text-ink">
                  {meds.map((m) => (
                    <li key={m.id}>
                      <strong>{m.name}</strong>
                      {m.dose && ` ${m.dose}`} — {scheduleText(m)}
                      {m.instructions && `, ${m.instructions}`}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-ink-muted">Doctor</dt>
            <dd className="mt-0.5 text-ink">
              {info.doctorName || '—'}
              {info.doctorPhone && (
                <a href={`tel:${info.doctorPhone.replace(/[^+0-9]/g, '')}`} className="mt-0.5 flex items-center gap-1 font-semibold text-primary-700">
                  <Phone aria-hidden="true" className="h-3.5 w-3.5" /> {info.doctorPhone}
                </a>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-ink-muted">Hospital</dt>
            <dd className="mt-0.5 text-ink">{info.hospital || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold uppercase tracking-wide text-ink-muted">Call</dt>
            <dd className="mt-1 grid gap-2 sm:grid-cols-2">
              {contacts.length === 0 ? (
                <span className="text-ink">Add phone numbers to family members’ profiles to show them here.</span>
              ) : (
                contacts.map((c) => (
                  <span key={c.id} className="rounded-xl border border-line px-3 py-2">
                    <span className="block font-semibold text-ink">{c.name}</span>
                    <span className="block text-[0.8125rem] text-ink-muted">{c.relation}</span>
                    {c.phone ? (
                      <a href={`tel:${c.phone.replace(/[^+0-9]/g, '')}`} className="flex items-center gap-1 font-semibold text-primary-700">
                        <Phone aria-hidden="true" className="h-3.5 w-3.5" /> {c.phone}
                      </a>
                    ) : (
                      <span className="text-[0.8125rem] text-ink-subtle">No phone number saved</span>
                    )}
                  </span>
                ))
              )}
            </dd>
          </div>
        </dl>
        <footer className="mt-6 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-ink-subtle">
          <HeartPulse aria-hidden="true" className="h-3.5 w-3.5" />
          From Hearth{info.updatedAt ? `, updated ${new Date(info.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Not medical advice.
        </footer>
      </article>

      {editing && <EmergencyDialog personId={personId} initial={info} onClose={() => setEditing(false)} onSaved={() => void data.reload()} />}
    </>
  );
}

function EmergencyDialog({ personId, initial, onClose, onSaved }: { personId: string; initial: EmergencyInput; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<EmergencyInput>({
    bloodGroup: initial.bloodGroup,
    allergies: initial.allergies,
    doctorName: initial.doctorName,
    doctorPhone: initial.doctorPhone,
    hospital: initial.hospital,
    notes: initial.notes,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof EmergencyInput, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      await medicationService.saveEmergency(personId, form);
      toast({ title: 'Emergency card updated' });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'It couldn’t be saved.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!pending}
      title="Emergency details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={pending}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Blood group">
          {(field) => (
            <Select {...field} value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g || 'Not known'}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Allergies" hint="Medicines, foods, anything else">
          {(field) => <Input {...field} value={form.allergies} maxLength={500} onChange={(e) => set('allergies', e.target.value)} />}
        </FormField>
        <FormField label="Doctor">{(field) => <Input {...field} value={form.doctorName} maxLength={120} onChange={(e) => set('doctorName', e.target.value)} />}</FormField>
        <FormField label="Doctor’s phone">{(field) => <Input {...field} type="tel" value={form.doctorPhone} maxLength={30} onChange={(e) => set('doctorPhone', e.target.value)} />}</FormField>
        <FormField label="Usual hospital" className="sm:col-span-2">
          {(field) => <Input {...field} value={form.hospital} maxLength={200} onChange={(e) => set('hospital', e.target.value)} />}
        </FormField>
        <FormField label="Good to know" hint="Mobility, hearing, language, anything that helps" className="sm:col-span-2">
          {(field) => <Textarea {...field} rows={3} maxLength={1000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}
        </FormField>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </div>
    </Dialog>
  );
}
