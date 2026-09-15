import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, CircleCheck, Clock, Lightbulb, PlaneTakeoff, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, formatClock, formatTime, isSameDay, toDateInputValue } from '@/lib/dates';
import { maxLength, required, validate } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { PRIORITIES, TASK_CATEGORIES } from '@/constants/labels';
import { Avatar, Button, Card, CardHeader, Checkbox, Disclosure, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, SegmentedControl, Select, Textarea, useToast } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import type { CareTask, TaskCategory, TaskPriority } from '@/types/domain';

interface FormState {
  title: string;
  category: TaskCategory;
  date: string;
  time: string;
  durationMin: number;
  assigneeId: string | null;
  priority: TaskPriority;
  notes: string;
  appointmentId: string;
  reminder: boolean;
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

function nextHalfHour(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fromTask(t: CareTask): FormState {
  const d = new Date(t.start);
  return {
    title: t.title,
    category: t.category,
    date: toDateInputValue(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    durationMin: t.durationMin,
    assigneeId: t.assigneeId,
    priority: t.priority,
    notes: t.notes,
    appointmentId: t.appointmentId ?? '',
    reminder: t.reminder,
  };
}

function TaskForm({ existing }: { existing?: CareTask }) {
  const { members, me, firstNameOf } = useFamily();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() =>
    existing
      ? fromTask(existing)
      : {
          title: params.get('title') ?? '',
          category: (params.get('category') as TaskCategory) || 'other',
          date: params.get('date') ?? toDateInputValue(),
          time: nextHalfHour(),
          durationMin: 30,
          assigneeId: me?.id ?? null,
          priority: 'routine',
          notes: '',
          appointmentId: params.get('appointment') ?? '',
          reminder: true,
        },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [advisoryDismissed, setAdvisoryDismissed] = useState(false);
  const save = useMutation((input: Parameters<typeof taskService.createTask>[0]) => (existing ? taskService.updateTask(existing.id, input) : taskService.createTask(input)));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'assigneeId' || key === 'date' || key === 'time' || key === 'durationMin') setAdvisoryDismissed(false);
  };

  const start = form.date && form.time ? combineDateTime(form.date, form.time) : undefined;
  const helpers = members.filter((m) => m.status === 'active' && m.role !== 'observer');

  const context = useAsync(() => Promise.all([taskService.listTasks(), appointmentService.list()]), []);
  const scores = useAsync(
    () => (start ? decisionService.previewCandidates({ taskId: existing?.id, category: form.category, start, durationMin: form.durationMin }) : Promise.resolve([])),
    [start, form.category, form.durationMin, existing?.id],
  );

  const scoreFor = (id: string) => scores.data?.find((s) => s.memberId === id);
  const selected = form.assigneeId ? scoreFor(form.assigneeId) : undefined;
  const best = scores.data?.[0];
  const showAdvisory = !advisoryDismissed && selected && selected.cautions.length > 0 && selected.score < 70;

  const dayTasks = useMemo(
    () => (context.data?.[0] ?? []).filter((t) => form.date && isSameDay(t.start, `${form.date}T12:00:00`) && t.status !== 'cancelled' && t.id !== existing?.id),
    [context.data, form.date, existing?.id],
  );
  const upcomingAppointments = (context.data?.[1] ?? []).filter((a) => new Date(a.start).getTime() > Date.now() - 86_400_000);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {
      title: validate(form.title, required('A title'), maxLength('The title', 100)),
      date: form.date ? undefined : 'Choose a date.',
      time: form.time ? undefined : 'Choose a time.',
      notes: validate(form.notes, maxLength('Notes', 1000)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !start) return;
    const task = await save.run({
      title: form.title,
      notes: form.notes,
      category: form.category,
      priority: form.priority,
      start,
      durationMin: form.durationMin,
      assigneeId: form.assigneeId,
      appointmentId: form.appointmentId || undefined,
      reminder: form.reminder,
    });
    if (task) {
      toast({ title: existing ? 'Task updated' : 'Task created', description: !form.assigneeId ? 'It’s waiting for someone to take it.' : form.assigneeId === me?.id ? 'It’s on your list.' : `${firstNameOf(form.assigneeId)} has been notified.` });
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Household care"
        title={existing ? 'Edit task' : 'Create a care task'}
        description="Shared with everyone in your circle."
        breadcrumbs={[{ label: 'Tasks', to: '/tasks' }, ...(existing ? [{ label: existing.title, to: `/tasks/${existing.id}` }] : []), { label: existing ? 'Edit' : 'New task' }]}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padding="lg">
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormError message={save.error} />
            <FormField label="Task title" required error={errors.title} aside="Clear & brief">
              {(p) => <Input {...p} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Afternoon medication & water" maxLength={120} />}
            </FormField>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Type of care</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map((c) => {
                  const meta = TASK_CATEGORIES[c];
                  const Icon = meta.icon;
                  const active = form.category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('category', c)}
                      className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors', active ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line text-ink-muted hover:border-primary-300 hover:text-ink')}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="truncate">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Date" required error={errors.date}>
                {(p) => <Input {...p} type="date" leftIcon={<CalendarDays />} value={form.date} onChange={(e) => set('date', e.target.value)} />}
              </FormField>
              <FormField label="Time" required error={errors.time}>
                {(p) => <Input {...p} type="time" step={300} leftIcon={<Clock />} value={form.time} onChange={(e) => set('time', e.target.value)} />}
              </FormField>
              <FormField label="How long">
                {(p) => (
                  <Select {...p} value={form.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))}>
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d < 60 ? `${d} minutes` : `${d / 60} hour${d > 60 ? 's' : ''}`}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>

            <fieldset>
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-sm font-semibold text-ink">Who will do it?</legend>
                <span className="text-xs text-ink-subtle">Scores show how well each person fits this time</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Assign to">
                {helpers.map((m) => {
                  const active = form.assigneeId === m.id;
                  const s = scoreFor(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set('assigneeId', m.id)}
                      className={cn('relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors', active ? 'border-mint-400 bg-mint-50' : 'border-line hover:border-primary-300')}
                    >
                      {active && <Check aria-hidden="true" className="absolute right-2 top-2 h-4 w-4 text-mint-600" strokeWidth={3} />}
                      <Avatar name={m.name} seed={m.id} />
                      <span className="text-sm font-semibold text-ink">
                        {m.name.split(' ')[0]}
                        {m.id === me?.id && ' (you)'}
                      </span>
                      <span className="text-xs text-ink-subtle">{m.relation || 'Member'}</span>
                      {s && <ScorePill score={s.score} label={`${m.name} suitability`} />}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.assigneeId === null}
                  onClick={() => set('assigneeId', null)}
                  className={cn('flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-3 text-center text-sm font-semibold', form.assigneeId === null ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line-strong text-ink-muted hover:border-primary-300')}
                >
                  Leave unassigned
                  <span className="text-xs font-normal text-ink-subtle">Anyone can pick it up</span>
                </button>
              </div>
            </fieldset>

            {showAdvisory && selected && (
              <div role="status" className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary-800">
                  <PlaneTakeoff aria-hidden="true" className="h-4 w-4" /> Schedule advisory
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-semibold text-amber-700">Non-blocking</span>
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                  {selected.cautions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {best && best.memberId !== form.assigneeId && best.score > selected.score && (
                    <Button size="sm" variant="soft" leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />} onClick={() => set('assigneeId', best.memberId)}>
                      Assign to {firstNameOf(best.memberId)} instead
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAdvisoryDismissed(true)}>
                    Keep {firstNameOf(form.assigneeId)}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-ink" id="priority-label">
                Priority
              </p>
              <SegmentedControl
                label="Priority"
                value={form.priority}
                onChange={(v) => set('priority', v)}
                options={(Object.keys(PRIORITIES) as TaskPriority[]).map((p) => ({ value: p, label: PRIORITIES[p].label }))}
              />
            </div>

            <Disclosure title="Optional details" meta="Notes, linked appointment, reminder" defaultOpen={Boolean(existing?.notes || form.appointmentId)}>
              <div className="space-y-4">
                <FormField label="Notes & instructions" error={errors.notes} hint="Visible to everyone who can see this task.">
                  {(p) => <Textarea {...p} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything the helper should know…" />}
                </FormField>
                <FormField label="Linked appointment" hint="Linking tells Hearth the visit depends on this task.">
                  {(p) => (
                    <Select {...p} value={form.appointmentId} onChange={(e) => set('appointmentId', e.target.value)}>
                      <option value="">None</option>
                      {upcomingAppointments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} — {new Date(a.start).toLocaleDateString()}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <Checkbox label="Send a gentle reminder 15 minutes before" checked={form.reminder} onChange={(e) => set('reminder', e.target.checked)} />
              </div>
            </Disclosure>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.pending} leftIcon={<CircleCheck aria-hidden="true" className="h-4 w-4" />}>
                {existing ? 'Save changes' : 'Create task'}
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="That day’s rhythm" description={form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : undefined} />
            {dayTasks.length ? (
              <ul className="space-y-2">
                {dayTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                    <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-ink-subtle">{formatTime(t.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{t.title}</span>
                      <span className="block text-xs text-ink-subtle">{firstNameOf(t.assigneeId)}</span>
                    </span>
                  </li>
                ))}
                {form.time && (
                  <li className="flex items-center gap-3 rounded-xl border border-dashed border-primary-300 bg-primary-50 px-3 py-2.5">
                    <span className="w-16 shrink-0 text-xs font-semibold text-primary-700">{formatClock(form.time)}</span>
                    <span className="truncate text-[13px] font-semibold text-primary-800">{form.title || 'This task'}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">Nothing else is planned that day.</p>
            )}
          </Card>
          <Card tone="mint" className="flex gap-3">
            <Lightbulb aria-hidden="true" className="h-5 w-5 shrink-0 text-mint-700" />
            <p className="text-sm text-mint-800">Assigning tasks in advance, with a reminder, gives helpers time to plan — and avoids last-minute scrambles.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function TaskFormPage() {
  const { taskId } = useParams();
  useDocumentTitle(taskId ? 'Edit task' : 'New task');
  const existing = useAsync(() => (taskId ? taskService.getTask(taskId) : Promise.resolve(undefined)), [taskId]);
  if (taskId && existing.status === 'loading') return <PageSkeleton />;
  if (existing.status === 'error') return <ErrorState headingLevel="h1" title="We couldn’t open this task" message={existing.error?.message} onRetry={existing.reload} />;
  return <TaskForm key={taskId ?? 'new'} existing={existing.data} />;
}
