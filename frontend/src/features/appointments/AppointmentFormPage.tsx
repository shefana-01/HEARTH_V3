import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, toDateInputValue } from '@/lib/dates';
import { maxLength, required, validate } from '@/lib/validation';
import { ActionBar, Button, Card, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, Select, Textarea, useToast } from '@/components/ui';
import { PersonSelect, VisibilityField } from '@/components/domain/People';
import type { Appointment, Visibility } from '@/types/domain';

const DURATIONS = [15, 30, 45, 60, 90, 120];

function AppointmentForm({ existing }: { existing?: Appointment }) {
  const { members, me, firstNameOf } = useFamily();
  const navigate = useNavigate();
  const { toast } = useToast();
  const start = existing ? new Date(existing.start) : undefined;
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    specialty: existing?.specialty ?? '',
    date: start ? toDateInputValue(start) : '',
    time: start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '10:00',
    durationMin: existing?.durationMin ?? 60,
    provider: existing?.provider ?? '',
    location: existing?.location ?? '',
    forId: existing?.forId ?? me?.id ?? '',
    escortId: existing?.escortId ?? '',
    visibility: (existing?.visibility ?? 'family') as Visibility,
    note: existing?.note ?? '',
    prep: '',
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useMutation(async () => {
    const payload = {
      title: form.title.trim(),
      specialty: form.specialty.trim(),
      start: combineDateTime(form.date, form.time),
      durationMin: form.durationMin,
      provider: form.provider.trim(),
      location: form.location.trim(),
      forId: form.forId,
      escortId: form.escortId || null,
      visibility: form.visibility,
      note: form.note.trim(),
    };
    return existing ? appointmentService.update(existing.id, payload) : appointmentService.create({ ...payload, prep: form.prep.split('\n') });
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  // Whoever the visit is for does not need to be asked to go along with themselves.
  const setForId = (forId: string) => setForm((f) => ({ ...f, forId, escortId: f.escortId === forId ? '' : f.escortId }));
  const companions = members.filter((m) => m.status === 'active' && m.role !== 'observer' && m.id !== form.forId);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      title: validate(form.title, required('A title'), maxLength('The title', 100)),
      date: form.date ? undefined : 'Choose a date.',
      time: form.time ? undefined : 'Choose a time.',
      provider: validate(form.provider, required('Who the visit is with')),
      note: validate(form.note, maxLength('The note', 500)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const saved = await save.run();
    if (saved) {
      toast({ title: existing ? 'Appointment updated' : 'Appointment added', description: saved.escortId ? `${firstNameOf(saved.escortId)} is going along.` : 'Nobody is going along yet.' });
      navigate(`/appointments/${saved.id}`);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Appointments', to: '/appointments' }, { label: existing ? 'Edit appointment' : 'New appointment' }]}
        title={existing ? 'Edit appointment' : 'Add an appointment'}
        description="Share visit details so the family knows who it is for, who is going along and what to bring."
      />
      <Card padding="lg" className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormError message={save.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="What is the visit?" required error={errors.title} className="sm:col-span-2">
              {(p) => <Input {...p} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Follow-up with the heart specialist" />}
            </FormField>
            <PersonSelect label="Who is it for?" value={form.forId} onChange={setForId} required className="sm:col-span-2" />
            <FormField label="Type or specialty" aside="Optional">
              {(p) => <Input {...p} value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="e.g. Cardiology, Dentist, GP" />}
            </FormField>
            <FormField label="Doctor or clinic" required error={errors.provider} hint="Or whoever the visit is with.">
              {(p) => <Input {...p} value={form.provider} onChange={(e) => set('provider', e.target.value)} />}
            </FormField>
            <FormField label="Date" required error={errors.date}>
              {(p) => <Input {...p} type="date" leftIcon={<CalendarDays />} value={form.date} onChange={(e) => set('date', e.target.value)} />}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Time" required error={errors.time}>
                {(p) => <Input {...p} type="time" leftIcon={<Clock />} value={form.time} onChange={(e) => set('time', e.target.value)} />}
              </FormField>
              <FormField label="Length">
                {(p) => (
                  <Select {...p} value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))}>
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <FormField label="Location" aside="Optional" className="sm:col-span-2">
              {(p) => <Input {...p} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Address, building or room" />}
            </FormField>
            <FormField label="Who is going along?" hint="They’ll be asked and the visit counts in their schedule." className="sm:col-span-2">
              {(p) => (
                <Select {...p} value={form.escortId} onChange={(e) => set('escortId', e.target.value)}>
                  <option value="">Nobody</option>
                  {companions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {!existing && (
              <FormField label="Things to bring or prepare" aside="One per line" className="sm:col-span-2">
                {(p) => <Textarea {...p} value={form.prep} onChange={(e) => set('prep', e.target.value)} placeholder={'Medication list\nInsurance card'} />}
              </FormField>
            )}
            <FormField label="Note for the family" aside="Optional" error={errors.note} className="sm:col-span-2">
              {(p) => <Textarea {...p} value={form.note} onChange={(e) => set('note', e.target.value)} />}
            </FormField>
            <div className="sm:col-span-2">
              <VisibilityField name="visibility" value={form.visibility} onChange={(v) => set('visibility', v)} what="appointment" />
            </div>
          </div>
          <ActionBar className="flex-row lg:justify-end lg:border-t lg:border-line lg:pt-5">
            <Button variant="secondary" size="lg" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={save.pending}>
              {existing ? 'Save changes' : 'Add appointment'}
            </Button>
          </ActionBar>
        </form>
      </Card>
    </>
  );
}

export default function AppointmentFormPage() {
  const { appointmentId } = useParams();
  useDocumentTitle(appointmentId ? 'Edit appointment' : 'New appointment');
  const existing = useAsync(() => (appointmentId ? appointmentService.get(appointmentId) : Promise.resolve(undefined)), [appointmentId]);
  if (appointmentId && existing.status === 'loading') return <PageSkeleton />;
  if (existing.status === 'error') return <ErrorState headingLevel="h1" message={existing.error?.message} onRetry={existing.reload} />;
  return <AppointmentForm key={appointmentId ?? 'new'} existing={existing.data} />;
}
