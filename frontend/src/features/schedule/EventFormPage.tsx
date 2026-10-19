import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, Info, MapPin, Trash2, UserX } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { eventService } from '@/services/schedule/eventService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EVENT_KINDS, WEEKDAY_LABELS } from '@/constants/labels';
import {
  ActionBar,
  Button,
  ButtonLink,
  Callout,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  FormField,
  Input,
  PageHeader,
  PageSkeleton,
  RadioCards,
  ToggleChip,
  useToast,
} from '@/components/ui';
import { initialState, selectedDays, toInput, validateForm, type EventFormErrors, type EventFormState } from './eventForm';
import type { EventKind, PersonalEvent, PersonalEventInput } from '@/types/domain';

function EventForm({ existing }: { existing?: PersonalEvent }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(() => initialState(existing));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const save = useMutation((input: PersonalEventInput) => (existing ? eventService.update(existing.id, input) : eventService.create(input)));
  const remove = useMutation(eventService.remove);
  const set = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const days = selectedDays(form);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validateForm(form);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    if (await save.run(toInput(form))) {
      toast({ title: existing ? 'Saved' : 'Added to your schedule' });
      navigate('/schedule');
    }
  };

  const onRemove = async () => {
    if (!existing) return;
    const removed = await remove.attempt(existing.id);
    setConfirmRemove(false);
    if (removed) {
      toast({ title: 'Removed from your schedule' });
      navigate('/schedule');
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Schedule', to: '/schedule' }, { label: existing ? 'Edit event' : 'Add to my schedule' }]} title={existing ? 'Edit event' : 'Add to my schedule'} />
      {!existing && (
        <Callout tone="primary" icon={<Info aria-hidden="true" />} className="mb-6 max-w-3xl">
          Hearth uses your schedule to avoid planning tasks while you are busy, and to work out who is free when someone needs a hand.
        </Callout>
      )}
      <Card padding="lg" className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <FormError message={save.error ?? remove.error} />

          <FormField label="Name" required error={errors.title}>
            {(p) => <Input {...p} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Software Engineering lecture" maxLength={100} />}
          </FormField>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">What kind of event is it?</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(EVENT_KINDS) as [EventKind, (typeof EVENT_KINDS)[EventKind]][]).map(([kind, { label, icon: Icon }]) => (
                <ToggleChip key={kind} pressed={form.kind === kind} onClick={() => set('kind', kind)}>
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label}
                </ToggleChip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={form.repeat === 'weekly' ? 'First day' : 'Date'} required error={errors.date}>
              {(p) => <Input {...p} type="date" leftIcon={<CalendarDays />} value={form.date} onChange={(e) => set('date', e.target.value)} />}
            </FormField>
            <FormField label="Starts" required error={errors.startTime}>
              {(p) => <Input {...p} type="time" leftIcon={<Clock />} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />}
            </FormField>
            <FormField label="Ends" required error={errors.endTime}>
              {(p) => <Input {...p} type="time" leftIcon={<Clock />} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />}
            </FormField>
          </div>

          <RadioCards<EventFormState['repeat']>
            name="repeat"
            legend="Does it repeat?"
            columns={2}
            value={form.repeat}
            onChange={(value) => set('repeat', value)}
            options={[
              { value: 'none', label: 'Just once' },
              { value: 'weekly', label: 'Every week' },
            ]}
          />

          {form.repeat === 'weekly' && (
            <div className="space-y-5 rounded-2xl bg-surface-muted p-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">
                  On these days <span className="text-red-600">*</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <ToggleChip
                      key={label}
                      pressed={days[i]}
                      onClick={() =>
                        set(
                          'days',
                          days.map((on, j) => (j === i ? !on : on)),
                        )
                      }
                    >
                      {label}
                    </ToggleChip>
                  ))}
                </div>
                {errors.days && <p className="mt-1.5 text-[0.8125rem] font-medium text-red-600">{errors.days}</p>}
              </fieldset>
              <FormField label="Until" aside="Optional" hint="Leave empty if it keeps going." error={errors.until} className="max-w-xs">
                {(p) => <Input {...p} type="date" value={form.until} min={form.date} onChange={(e) => set('until', e.target.value)} />}
              </FormField>
            </div>
          )}

          <FormField label="Place" aside="Optional">
            {(p) => <Input {...p} leftIcon={<MapPin />} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Room, building or address" />}
          </FormField>

          <RadioCards<EventFormState['visibility']>
            name="visibility"
            legend="What does your family see?"
            columns={2}
            value={form.visibility}
            onChange={(value) => set('visibility', value)}
            options={[
              { value: 'details', label: 'The name and time', description: 'They can plan around it and know where you are.' },
              { value: 'busy', label: 'Only that I’m busy', description: 'The name and place stay private. Hearth still plans around it.' },
            ]}
          />

          {existing && (
            <div className="border-t border-line pt-5">
              <Button variant="danger-ghost" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setConfirmRemove(true)}>
                Remove from my schedule
              </Button>
            </div>
          )}

          <ActionBar className="flex-row lg:justify-end lg:border-t lg:border-line lg:pt-5">
            <Button variant="secondary" size="lg" onClick={() => navigate('/schedule')}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={save.pending}>
              {existing ? 'Save changes' : 'Add to my schedule'}
            </Button>
          </ActionBar>
        </form>
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={onRemove}
        title="Remove this from your schedule?"
        description={existing ? `“${existing.title}” will no longer show up, and Hearth will stop treating that time as busy.` : undefined}
        confirmLabel="Remove"
        variant="danger"
        loading={remove.pending}
      />
    </>
  );
}

export default function EventFormPage() {
  const { eventId } = useParams();
  useDocumentTitle(eventId ? 'Edit event' : 'Add to my schedule');
  const { me } = useFamily();
  const loaded = useAsync(() => (eventId ? eventService.get(eventId) : Promise.resolve(undefined)), [eventId]);

  if (!me || (eventId && loaded.status === 'loading')) return <PageSkeleton />;
  if (loaded.status === 'error') return <ErrorState headingLevel="h1" title="We couldn’t open this event" message={loaded.error?.message} onRetry={loaded.reload} />;
  if (loaded.data && loaded.data.memberId !== me.id) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={<UserX aria-hidden="true" />}
        title="This is someone else’s event"
        description="Only the person who added it can change or remove it."
        action={<ButtonLink to="/schedule">Back to schedule</ButtonLink>}
      />
    );
  }
  return <EventForm key={eventId ?? 'new'} existing={loaded.data} />;
}
