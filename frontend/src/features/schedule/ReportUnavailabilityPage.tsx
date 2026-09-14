import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarClock, Heart, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, formatDayTime, formatTime, toDateInputValue } from '@/lib/dates';
import { maxLength, validate } from '@/lib/validation';
import { UNAVAILABILITY_REASONS } from '@/constants/labels';
import { Badge, Button, Callout, Card, CardHeader, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, RadioCards, Select, Textarea, ToggleChip, useToast } from '@/components/ui';
import type { CareTask } from '@/types/domain';

type Mode = 'task' | 'rest-of-day' | 'custom';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const endOf = (t: CareTask) => new Date(new Date(t.start).getTime() + t.durationMin * 60_000);

export default function ReportUnavailabilityPage() {
  useDocumentTitle('Report unavailability');
  const { me, family } = useFamily();
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string | undefined> = {
      task: mode === 'task' && !selectedTask ? 'Choose the task you need covered.' : undefined,
      custom: mode === 'custom' && range && range.end <= range.start ? 'The end time must be after the start time.' : mode === 'custom' && !range ? 'Choose a date and times.' : undefined,
      note: validate(note, maxLength('The note', 500)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !range) return;
    const result = await report.run({ start: range.start.toISOString(), end: range.end.toISOString(), reason, note });
    if (!result) return;
    if (result.requestIds.length) {
      toast({ title: 'Thanks ΓÇö weΓÇÖll find cover', description: `${result.requestIds.length} task(s) need a new caregiver.` });
      navigate(result.requestIds.length === 1 ? `/priority/requests/${result.requestIds[0]}` : '/priority');
    } else {
      toast({ title: 'Time away recorded', description: 'None of your tasks were affected.' });
      navigate('/schedule');
    }
  };

  if (tasks.status === 'loading' && !tasks.data) return <PageSkeleton />;
  if (tasks.status === 'error') return <ErrorState headingLevel="h1" message={tasks.error?.message} onRetry={tasks.reload} />;

  return (
    <>
      <PageHeader
        back={{ to: '/schedule', label: 'Back to schedule' }}
        eyebrow="Care continuity"
        title="Report unavailability"
        meta={<Badge tone="mint" dot size="md">Nothing changes until someone confirms</Badge>}
      />
      <Callout tone="primary" icon={<Heart aria-hidden="true" />} title="Life happens, and thatΓÇÖs okay." className="mb-6">
        Tell the circle when you canΓÇÖt help. Hearth will suggest who can cover so {family?.recipient.name ?? 'your loved one'} is looked after calmly.
      </Callout>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card padding="lg">
          <form onSubmit={onSubmit} noValidate className="space-y-7">
            <FormError message={report.error} />
            <RadioCards
              name="mode"
              legend="1. How long are you unavailable?"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'task', label: 'Just one task', description: 'Your other commitments stay as they are.', disabled: upcoming.length === 0, aside: upcoming.length === 0 ? <Badge>No upcoming tasks</Badge> : undefined },
                { value: 'rest-of-day', label: 'The rest of today', description: `From now until midnight.` },
                { value: 'custom', label: 'A specific time', description: 'Choose a date and a time range.' },
              ]}
            />

            {mode === 'task' && (
              <FormField label="Task you need covered" error={errors.task} required>
                {(p) => (
                  <Select {...p} value={selectedTask?.id ?? ''} onChange={(e) => setTaskId(e.target.value)}>
                    {upcoming.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ΓÇö {formatDayTime(t.start)}
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
                {errors.custom && <p className="mt-2 text-[13px] font-medium text-red-600">{errors.custom}</p>}
              </div>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                2. Reason <span className="font-normal text-ink-subtle">(optional ΓÇö helps the family plan)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {UNAVAILABILITY_REASONS.map((r) => (
                  <ToggleChip key={r} pressed={reason === r} onClick={() => setReason(reason === r ? '' : r)}>
                    {r}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <FormField label="3. A note for the circle" aside="Optional" error={errors.note} hint="Visible to your family circle only.">
              {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that would help whoever covers for youΓÇª" />}
            </FormField>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={report.pending} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                {affected.length ? 'Report & find cover' : 'Report time away'}
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="What this affects" icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />} description={range ? `${formatDayTime(range.start.toISOString())} ΓÇô ${formatTime(range.end.toISOString())}` : undefined} />
            {affected.length ? (
              <ul className="space-y-2">
                {affected.map((t) => (
                  <li key={t.id} className="rounded-xl bg-rose-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-ink">{t.title}</p>
                    <p className="text-xs text-ink-subtle">{formatDayTime(t.start)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2 text-sm text-ink-muted">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                None of your tasks fall in this time.
              </p>
            )}
            {affected.length > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-[13px] text-primary-800">
                <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Hearth will rank who is free, not overloaded and able to help.
              </p>
            )}
          </Card>
          <Card tone="mint" padding="sm" className="flex gap-2 text-[13px] text-mint-800">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            No assignment changes until you or the lead caregiver approves one.
          </Card>
        </aside>
      </div>
    </>
  );
}
