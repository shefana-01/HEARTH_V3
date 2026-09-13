import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, toDateInputValue } from '@/lib/dates';
import { maxLength, required, validate } from '@/lib/validation';
import { Button, Card, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, Select, Textarea, useToast } from '@/components/ui';
import type { Appointment } from '@/types/domain';

const DURATIONS = [15, 30, 45, 60, 90, 120];

function AppointmentForm({ existing }: { existing?: Appointment }) {
  const { members, firstNameOf } = useFamily();
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
    escortId: existing?.escortId ?? '',
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
      escortId: form.escortId || null,
      note: form.note.trim(),
    };
    return existing ? appointmentService.update(existing.id, payload) : appointmentService.create({ ...payload, prep: form.prep.split('\n') });
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

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
      toast({ title: existing ? 'Appointment updated' : 'Appointment added', description: saved.escortId ? `${firstNameOf(saved.escortId)} will accompany.` : 'No escort chosen yet.' });
      navigate(`/appointments/${saved.id}`);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Appointments', to: '/appointments' }, { label: existing ? 'Edit appointment' : 'New appointment' }]}
        title={existing ? 'Edit appointment' : 'Add an appointment'}
        description="Share visit details so the circle knows who is going and what to bring."
      />
      <Card padding="lg" className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormError message={save.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="What is the visit?" required error={errors.title} className="sm:col-span-2">
              {(p) => <Input {...p} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Follow-up with the heart specialist" />}
            </FormField>
            <FormField label="Type or specialty" aside="Optional">
              {(p) => <Input {...p} value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="e.g. Cardiology, Dentist, GP" />}
            </FormField>
            <FormField label="With" required error={errors.provider} hint="Doctor, clinic or service.">
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
            <FormField label="Who will go with them?" hint="TheyΓÇÖll be notified and the visit counts in their schedule.">
              {(p) => (
                <Select {...p} value={form.escortId} onChange={(e) => set('escortId', e.target.value)}>
                  <option value="">Decide later</option>
                  {members
                    .filter((m) => m.status === 'active' && m.role !== 'observer')
                    .map((m) => (
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
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.pending}>
              {existing ? 'Save changes' : 'Add appointment'}
            </Button>
          </div>
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
