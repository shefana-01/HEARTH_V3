import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, formatDayTime, toDateInputValue } from '@/lib/dates';
import { plural } from '@/lib/format';
import { maxLength, validate } from '@/lib/validation';
import { UNAVAILABILITY_REASONS } from '@/constants/labels';
import { ActionBar, Badge, Button, Callout, Card, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, RadioCards, Select, Textarea, ToggleChip, useToast } from '@/components/ui';
import { AffectedTasks } from './AffectedTasks';
import type { Task } from '@/types/domain';

type Mode = 'task' | 'rest-of-day' | 'custom';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const endOf = (t: Task) => new Date(new Date(t.start).getTime() + t.durationMin * 60_000);

export default function ReportUnavailabilityPage() {
  useDocumentTitle('I can’t make it');
  const { me } = useFamily();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const tasks = useAsync(() => taskService.listTasks({ assigneeId: me?.id }), [me?.id]);
  const upcoming = useMemo(() => (tasks.data ?? []).filter((t) => t.status === 'scheduled' && endOf(t).getTime() > Date.now()), [tasks.data]);

  const [mode, setMode] = useState<Mode>(params.get('task') ? 'task' : 'rest-of-day');
  const [taskId, setTaskId] = useState(params.get('task') ?? '');
  const [custom, setCustom] = useState({ date: toDateInputValue(), from: hhmm(new Date()), to: '21:00' });
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const report = useMutation(scheduleService.reportUnavailability);

  const selectedTask = upcoming.find((t) => t.id === taskId) ?? (mode === 'task' ? upcoming[0] : undefined);

  const range = useMemo((): { start: Date; end: Date } | null => {
    if (mode === 'task') return selectedTask ? { start: new Date(selectedTask.start), end: endOf(selectedTask) } : null;
    if (mode === 'rest-of-day') {
      const end = new Date();
      end.setHours(23, 59, 0, 0);
      return { start: new Date(), end };
    }
    if (!custom.date || !custom.from || !custom.to) return null;
    return { start: new Date(combineDateTime(custom.date, custom.from)), end: new Date(combineDateTime(custom.date, custom.to)) };
  }, [mode, selectedTask, custom]);

  const affected = range ? upcoming.filter((t) => new Date(t.start) < range.end && endOf(t) > range.start) : [];
  const sharedAffected = affected.filter((t) => t.visibility === 'family');
  const privateAffected = affected.filter((t) => t.visibility === 'private');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string | undefined> = {
      task: mode === 'task' && !selectedTask ? 'Choose the task you can’t do.' : undefined,
      custom: mode === 'custom' && range && range.end <= range.start ? 'The end time must be after the start time.' : mode === 'custom' && !range ? 'Choose a date and times.' : undefined,
      note: validate(note, maxLength('The note', 500)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !range) return;
    const result = await report.run({ start: range.start.toISOString(), end: range.end.toISOString(), reason, note });
    if (!result) return;
    const privateCount = result.personalTaskIds.length;
    const privateNote = privateCount ? `${plural(privateCount, 'private task')} ${privateCount === 1 ? 'falls' : 'fall'} in this time. Move ${privateCount === 1 ? 'it' : 'them'} yourself.` : '';
    if (result.requestIds.length) {
      toast({
        title: 'Thanks — we’ll find someone',
        description: [`Hearth is looking for someone to take ${plural(result.requestIds.length, 'shared task')}.`, privateNote].filter(Boolean).join(' '),
      });
      navigate(result.requestIds.length === 1 ? `/priority/requests/${result.requestIds[0]}` : '/priority');
    } else {
      toast({ title: 'Your family knows', description: [`None of your shared tasks are affected.`, privateNote].filter(Boolean).join(' ') });
      navigate('/schedule');
    }
  };

  if (tasks.status === 'loading' && !tasks.data) return <PageSkeleton />;
  if (tasks.status === 'error') return <ErrorState headingLevel="h1" message={tasks.error?.message} onRetry={tasks.reload} />;

  return (
    <>
      <PageHeader
        back={{ to: '/schedule', label: 'Back to schedule' }}
        title="I can’t make it"
        meta={
          <Badge tone="mint" dot size="md">
            Nothing is handed over until it is approved
          </Badge>
        }
      />
      <Callout tone="primary" icon={<Heart aria-hidden="true" />} title="Life happens, and that’s okay." className="mb-6">
        Tell your family when you can’t make it. Hearth will look for someone who is free to take your shared tasks.
      </Callout>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card padding="lg">
          <form onSubmit={onSubmit} noValidate className="space-y-7">
            <FormError message={report.error} />
            <RadioCards
              name="mode"
              legend="1. When can’t you make it?"
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: 'task',
                  label: 'Just one task',
                  description: 'Everything else you have planned stays as it is.',
                  disabled: upcoming.length === 0,
                  aside: upcoming.length === 0 ? <Badge>No upcoming tasks</Badge> : undefined,
                },
                { value: 'rest-of-day', label: 'The rest of today', description: `From now until midnight.` },
                { value: 'custom', label: 'A specific time', description: 'Choose a date and a time range.' },
              ]}
            />

            {mode === 'task' && (
              <FormField label="Which task can’t you do?" error={errors.task} required>
                {(p) => (
                  <Select {...p} value={selectedTask?.id ?? ''} onChange={(e) => setTaskId(e.target.value)}>
                    {upcoming.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} — {formatDayTime(t.start)}
                        {t.visibility === 'private' ? ' (private)' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            )}

            {mode === 'custom' && (
              <div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Date" required>
                    {(p) => <Input {...p} type="date" value={custom.date} onChange={(e) => setCustom({ ...custom, date: e.target.value })} />}
                  </FormField>
                  <FormField label="From" required>
                    {(p) => <Input {...p} type="time" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />}
                  </FormField>
                  <FormField label="To" required>
                    {(p) => <Input {...p} type="time" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />}
                  </FormField>
                </div>
                {errors.custom && <p className="mt-2 text-[0.8125rem] font-medium text-red-600">{errors.custom}</p>}
              </div>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                2. Reason <span className="font-normal text-ink-subtle">(optional — helps the family plan)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {UNAVAILABILITY_REASONS.map((r) => (
                  <ToggleChip key={r} pressed={reason === r} onClick={() => setReason(reason === r ? '' : r)}>
                    {r}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <FormField label="3. A note for your family" aside="Optional" error={errors.note} hint="Only your family can see this.">
              {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that would help whoever takes over…" />}
            </FormField>

            <ActionBar className="flex-row lg:justify-end lg:border-t lg:border-line lg:pt-5">
              <Button variant="secondary" size="lg" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={report.pending} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                {sharedAffected.length ? 'Tell my family & find someone' : 'Tell my family'}
              </Button>
            </ActionBar>
          </form>
        </Card>

        <aside className="space-y-4">
          <AffectedTasks range={range} shared={sharedAffected} mine={privateAffected} />
          <Card tone="mint" padding="sm" className="flex gap-2 text-[0.8125rem] text-mint-800">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Nothing is handed over until you or the family organiser approves it.
          </Card>
        </aside>
      </div>
    </>
  );
}
