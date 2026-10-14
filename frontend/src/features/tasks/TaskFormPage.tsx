import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, CircleCheck, Clock, Lightbulb, Lock, PlaneTakeoff, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, formatClock, formatTime, isSameDay, toDateInputValue } from '@/lib/dates';
import { maxLength, required, validate } from '@/lib/validation';
import { PERSONAL_CATEGORIES, PRIORITIES, TASK_CATEGORIES } from '@/constants/labels';
import {
  ActionBar,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Disclosure,
  ErrorState,
  FormError,
  FormField,
  Input,
  PageHeader,
  PageSkeleton,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { PersonSelect, VisibilityField } from '@/components/domain/People';
import type { Task, TaskCategory, TaskPriority, Visibility } from '@/types/domain';
import { AssigneePicker } from './AssigneePicker';
import { CategoryPicker } from './CategoryPicker';

interface FormState {
  title: string;
  category: TaskCategory;
  date: string;
  time: string;
  durationMin: number;
  assigneeId: string | null;
  forId: string;
  visibility: Visibility;
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

function fromTask(t: Task): FormState {
  const d = new Date(t.start);
  return {
    title: t.title,
    category: t.category,
    date: toDateInputValue(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    durationMin: t.durationMin,
    assigneeId: t.assigneeId,
    forId: t.forId ?? '',
    visibility: t.visibility,
    priority: t.priority,
    notes: t.notes,
    appointmentId: t.appointmentId ?? '',
    reminder: t.reminder,
  };
}

const defaultVisibility = (category: TaskCategory): Visibility => (PERSONAL_CATEGORIES.includes(category) ? 'private' : 'family');

function TaskForm({ existing }: { existing?: Task }) {
  const { me, firstNameOf } = useFamily();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => {
    if (existing) return fromTask(existing);
    const requested = params.get('category');
    const category = requested && requested in TASK_CATEGORIES ? (requested as TaskCategory) : 'other';
    return {
      title: params.get('title') ?? '',
      category,
      date: params.get('date') ?? toDateInputValue(),
      time: nextHalfHour(),
      durationMin: 30,
      assigneeId: me?.id ?? null,
      forId: '',
      visibility: defaultVisibility(category),
      priority: 'routine',
      notes: '',
      appointmentId: params.get('appointment') ?? '',
      reminder: true,
    };
  });
  // Once the person picks who can see the task, a new category no longer changes it.
  const [visibilityChosen, setVisibilityChosen] = useState(Boolean(existing));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [advisoryDismissed, setAdvisoryDismissed] = useState(false);
  const save = useMutation((input: Parameters<typeof taskService.createTask>[0]) => (existing ? taskService.updateTask(existing.id, input) : taskService.createTask(input)));

  const isPrivate = form.visibility === 'private';

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'assigneeId' || key === 'date' || key === 'time' || key === 'durationMin') setAdvisoryDismissed(false);
  };

  const setCategory = (category: TaskCategory) => setForm((f) => ({ ...f, category, visibility: visibilityChosen ? f.visibility : defaultVisibility(category) }));

  const setVisibility = (visibility: Visibility) => {
    setVisibilityChosen(true);
    set('visibility', visibility);
  };

  const start = form.date && form.time ? combineDateTime(form.date, form.time) : undefined;

  const context = useAsync(() => Promise.all([taskService.listTasks(), appointmentService.list()]), []);
  const scores = useAsync(
    () => (start && !isPrivate ? decisionService.previewCandidates({ taskId: existing?.id, category: form.category, start, durationMin: form.durationMin }) : Promise.resolve([])),
    [start, isPrivate, form.category, form.durationMin, existing?.id],
  );

  const candidates = scores.data ?? [];
  const selected = form.assigneeId ? candidates.find((s) => s.memberId === form.assigneeId) : undefined;
  const best = candidates[0];
  const showAdvisory = !isPrivate && !advisoryDismissed && selected && selected.cautions.length > 0 && selected.score < 70;

  const dayTasks = useMemo(
    () => (context.data?.[0] ?? []).filter((t) => form.date && isSameDay(t.start, `${form.date}T12:00:00`) && t.status !== 'cancelled' && t.id !== existing?.id),
    [context.data, form.date, existing?.id],
  );
  const upcomingAppointments = (context.data?.[1] ?? []).filter((a) => new Date(a.start).getTime() > Date.now() - 86_400_000);
  const whoDoes = (id: string | null) => (!id ? 'Needs someone' : id === me?.id ? 'Me' : firstNameOf(id));

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
    const assigneeId = isPrivate ? (me?.id ?? null) : form.assigneeId;
    const task = await save.run({
      title: form.title,
      notes: form.notes,
      category: form.category,
      priority: form.priority,
      start,
      durationMin: form.durationMin,
      assigneeId,
      forId: !isPrivate && form.forId ? form.forId : undefined,
      visibility: form.visibility,
      appointmentId: form.appointmentId || undefined,
      reminder: form.reminder,
    });
    if (task) {
      toast({
        title: existing ? 'Task updated' : 'Task added',
        description: isPrivate
          ? 'Only you can see it.'
          : !assigneeId
            ? 'It’s waiting for someone to take it.'
            : assigneeId === me?.id
              ? 'It’s on your list.'
              : `${firstNameOf(assigneeId)} has been told.`,
      });
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title={existing ? 'Edit task' : 'New task'}
        description={isPrivate ? 'Only you can see this task.' : 'Shared with your family.'}
        breadcrumbs={[{ label: 'Tasks', to: '/tasks' }, ...(existing ? [{ label: existing.title, to: `/tasks/${existing.id}` }] : []), { label: existing ? 'Edit' : 'New task' }]}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padding="lg">
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormError message={save.error} />
            <FormField label="Task title" required error={errors.title} aside="Short and clear">
              {(p) => <Input {...p} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Pick up Dadu’s medicine" maxLength={120} />}
            </FormField>

            <CategoryPicker value={form.category} onChange={setCategory} />

            <VisibilityField name="task-visibility" value={form.visibility} onChange={setVisibility} what="task" />

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

            {isPrivate ? (
              <Callout tone="primary" icon={<Lock aria-hidden="true" />}>
                This one is yours. Your family only sees that you are busy then.
              </Callout>
            ) : (
              <>
                <AssigneePicker value={form.assigneeId} onChange={(id) => set('assigneeId', id)} scores={candidates} />

                {showAdvisory && selected && (
                  <div role="status" className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary-800">
                      <PlaneTakeoff aria-hidden="true" className="h-4 w-4" /> Heads up
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-semibold text-amber-700">You can still save</span>
                    </p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
                      {selected.cautions.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {best && best.memberId !== form.assigneeId && best.score > selected.score && (
                        <Button size="sm" variant="soft" leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />} onClick={() => set('assigneeId', best.memberId)}>
                          Give it to {best.memberId === me?.id ? 'me' : firstNameOf(best.memberId)} instead
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setAdvisoryDismissed(true)}>
                        Keep it with {form.assigneeId === me?.id ? 'me' : firstNameOf(form.assigneeId)}
                      </Button>
                    </div>
                  </div>
                )}

                <PersonSelect label="Who is it for?" emptyLabel="Nobody in particular" value={form.forId} onChange={(id) => set('forId', id)} />
              </>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-ink">How important is it?</p>
              <SegmentedControl
                label="Priority"
                value={form.priority}
                onChange={(v) => set('priority', v)}
                options={(Object.keys(PRIORITIES) as TaskPriority[]).map((p) => ({ value: p, label: PRIORITIES[p].label }))}
              />
            </div>

            <Disclosure title="Optional details" meta="Notes, linked appointment, reminder" defaultOpen={Boolean(existing?.notes || form.appointmentId)}>
              <div className="space-y-4">
                <FormField label="Notes" error={errors.notes} hint={isPrivate ? 'Only you can see these.' : 'Everyone who can see this task can read these.'}>
                  {(p) => <Textarea {...p} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything whoever does this should know…" />}
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
                <Checkbox label="Remind me 15 minutes before" checked={form.reminder} onChange={(e) => set('reminder', e.target.checked)} />
              </div>
            </Disclosure>

            <ActionBar className="flex-row lg:justify-end lg:border-t lg:border-line lg:pt-5">
              <Button variant="secondary" size="lg" className="lg:h-10" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" size="lg" className="flex-1 sm:flex-none lg:h-10" loading={save.pending} leftIcon={<CircleCheck aria-hidden="true" className="h-4 w-4" />}>
                {existing ? 'Save changes' : 'Add task'}
              </Button>
            </ActionBar>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="That day" description={form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : undefined} />
            {dayTasks.length ? (
              <ul className="space-y-2">
                {dayTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                    <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-ink-subtle">{formatTime(t.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-ink">{t.title}</span>
                      <span className="block text-xs text-ink-subtle">{whoDoes(t.assigneeId)}</span>
                    </span>
                  </li>
                ))}
                {form.time && (
                  <li className="flex items-center gap-3 rounded-xl border border-dashed border-primary-300 bg-primary-50 px-3 py-2.5">
                    <span className="w-16 shrink-0 text-xs font-semibold text-primary-700">{formatClock(form.time)}</span>
                    <span className="truncate text-[0.8125rem] font-semibold text-primary-800">{form.title || 'This task'}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">Nothing else is planned that day.</p>
            )}
          </Card>
          <Card tone="mint" className="flex gap-3">
            <Lightbulb aria-hidden="true" className="h-5 w-5 shrink-0 text-mint-700" />
            <p className="text-sm text-mint-800">Setting a day and time ahead, with a reminder, gives whoever does it room to plan.</p>
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
