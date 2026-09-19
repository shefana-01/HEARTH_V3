import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CircleCheckBig, FlaskConical, RotateCcw, TriangleAlert } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTimeRange, toDateInputValue, combineDateTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Button, ButtonLink, Callout, Card, CardHeader, EmptyState, ErrorState, FormField, Input, PageHeader, PageSkeleton, Select, Skeleton, useToast } from '@/components/ui';
import { useSimulationParams } from './useSimulationParams';
import { SimulatorTabs, type SimulatorView } from './SimulatorTabs';
import type { CareTask, Conflict } from '@/types/domain';

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function TaskState({
  title,
  task,
  assigneeId,
  start,
  conflict,
  label,
  tone,
}: {
  title: string;
  task: CareTask;
  assigneeId: string | null;
  start: string;
  conflict?: Conflict;
  label: string;
  tone: 'neutral' | 'proposed';
}) {
  const { nameOf } = useFamily();
  const end = new Date(new Date(start).getTime() + task.durationMin * 60_000).toISOString();
  return (
    <Card tone={tone === 'proposed' ? (conflict ? 'red' : 'mint') : 'default'} className="h-full">
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={conflict ? 'red' : 'mint'} dot>
          {conflict ? (conflict.kind === 'unassigned' ? 'No owner' : 'Conflict') : 'No conflict'}
        </Badge>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-muted">{formatTimeRange(start, end)}</span>
      </div>
      <h3 className="mt-3 font-display text-xl">{title}</h3>
      <p className="text-sm text-ink-muted">{formatDayTime(start)}</p>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface/80 p-3">
        <Avatar name={nameOf(assigneeId)} seed={assigneeId ?? undefined} size="sm" />
        <span className="text-sm font-semibold text-ink">{nameOf(assigneeId)}</span>
      </div>
      {conflict && (
        <p className="mt-3 flex items-start gap-2 text-[13px] text-red-700">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {conflict.reason}
        </p>
      )}
    </Card>
  );
}

export default function SimulatorPage() {
  useDocumentTitle('What-if simulator');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { members, firstNameOf } = useFamily();
  const { change, update, query, hasChange } = useSimulationParams();
  const [searchParams] = useSearchParams();
  const view: SimulatorView = searchParams.get('view') === 'current' || !hasChange ? 'current' : 'proposed';

  const base = useAsync(() => Promise.all([taskService.listTasks(), decisionService.listAttention()]), []);
  const [tasks = [], attention = []] = base.data ?? [];
  const upcoming = useMemo(() => tasks.filter((t) => t.status === 'scheduled' && new Date(t.start).getTime() + t.durationMin * 60_000 > Date.now()), [tasks]);

  // Default to the most urgent conflicted task, or the next task.
  useEffect(() => {
    if (!change && base.data) {
      const first = attention[0]?.task.id ?? upcoming[0]?.id;
      if (first) update({ task: first });
    }
  }, [change, base.data, attention, upcoming, update]);

  const task = upcoming.find((t) => t.id === change?.taskId) ?? tasks.find((t) => t.id === change?.taskId);
  const sim = useAsync(() => (change && hasChange ? decisionService.simulate(change) : Promise.resolve(null)), [query]);
  const apply = useMutation(decisionService.applySimulation);

  if (base.status === 'loading' && !base.data) return <PageSkeleton />;
  if (base.status === 'error') return <ErrorState headingLevel="h1" message={base.error?.message} onRetry={base.reload} />;

  if (!upcoming.length) {
    return (
      <>
        <PageHeader eyebrow="Coordination diagnostics" title="What-if simulator" />
        <EmptyState
          icon={<FlaskConical aria-hidden="true" />}
          title="No upcoming tasks to simulate"
          description="Create a task first, then try moving it or giving it to someone else."
          action={<ButtonLink to="/tasks/new">Create a task</ButtonLink>}
        />
      </>
    );
  }

  const currentConflict = attention.find((a) => a.task.id === task?.id)?.conflict;
  const proposedAssignee = change?.assigneeId !== undefined ? change.assigneeId : (task?.assigneeId ?? null);
  const proposedStart = change?.start ?? task?.start ?? '';
  const proposedConflict = sim.data?.conflictsAfter.find((c) => c.taskId === task?.id);

  const onApply = async () => {
    if (!change) return;
    const r = await apply.run(change);
    if (r) {
      toast({ title: 'Schedule updated', description: `“${r.title}” was changed and the circle notified.` });
      navigate(`/tasks/${r.id}`);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Coordination diagnostics" title="What-if simulator" description="Try moving a task or giving it to someone else. Nothing changes until you apply it." />

      <Callout tone="rose" icon={<FlaskConical aria-hidden="true" />} className="mb-6" title="Simulation mode — no changes applied to the live schedule">
        Safe to experiment: results are calculated by the decision engine from your family’s current plan.
      </Callout>

      <Card className="mb-6">
        <CardHeader title="Set up the scenario" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Task" className="md:col-span-2">
            {(p) => (
              <Select {...p} value={change?.taskId ?? ''} onChange={(e) => update({ task: e.target.value })}>
                {upcoming.map((t) => (
                  <option key={t.id} value={t.id}>
                    {attention.some((a) => a.task.id === t.id) ? '⚠ ' : ''}
                    {t.title} — {formatDayTime(t.start)}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Give it to">
            {(p) => (
              <Select
                {...p}
                value={change?.assigneeId === undefined ? '__same__' : (change.assigneeId ?? 'none')}
                onChange={(e) => update({ assignee: e.target.value === '__same__' ? null : e.target.value })}
              >
                <option value="__same__">Keep {task ? firstNameOf(task.assigneeId) : 'current'}</option>
                {members
                  .filter((m) => m.status === 'active' && m.role !== 'observer' && m.id !== task?.assigneeId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                <option value="none">Nobody (unassign)</option>
              </Select>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Date">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={toDateInputValue(new Date(proposedStart || Date.now()))}
                  onChange={(e) => e.target.value && update({ start: combineDateTime(e.target.value, timeOf(proposedStart || new Date().toISOString())) })}
                />
              )}
            </FormField>
            <FormField label="Time">
              {(p) => (
                <Input
                  {...p}
                  type="time"
                  value={proposedStart ? timeOf(proposedStart) : ''}
                  onChange={(e) => e.target.value && update({ start: combineDateTime(toDateInputValue(new Date(proposedStart)), e.target.value) })}
                />
              )}
            </FormField>
          </div>
        </div>
        {hasChange && (
          <Button variant="ghost" size="sm" className="mt-3" leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />} onClick={() => change && update({ task: change.taskId })}>
            Reset simulation
          </Button>
        )}
      </Card>

      {task && <SimulatorTabs active={view} query={query} hasChange={hasChange} />}

      {task && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={cn(view !== 'current' && 'hidden lg:block')}>
            <TaskState label="Current state (live)" title={task.title} task={task} assigneeId={task.assigneeId} start={task.start} conflict={currentConflict} tone="neutral" />
          </div>
          <div className={cn(view !== 'proposed' && 'hidden lg:block')}>
            {!hasChange ? (
              <Card tone="muted" className="flex h-full flex-col items-center justify-center text-center">
                <FlaskConical aria-hidden="true" className="mb-3 h-8 w-8 text-primary-500" />
                <p className="font-display text-lg">Proposed state</p>
                <p className="mt-1 max-w-xs text-sm text-ink-muted">Choose a different person or time above to see what would happen.</p>
              </Card>
            ) : sim.status === 'loading' ? (
              <Skeleton className="h-full min-h-[14rem]" />
            ) : (
              <TaskState label="Proposed state (simulation)" title={task.title} task={task} assigneeId={proposedAssignee} start={proposedStart} conflict={proposedConflict} tone="proposed" />
            )}
          </div>
        </div>
      )}

      {hasChange && sim.data && (
        <Card className="mt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', sim.data.introduced.length ? 'bg-amber-100 text-amber-700' : 'bg-mint-100 text-mint-700')}>
                {sim.data.introduced.length ? <TriangleAlert aria-hidden="true" className="h-5 w-5" /> : <CircleCheckBig aria-hidden="true" className="h-5 w-5" />}
              </span>
              <div>
                <p className="font-semibold text-ink">
                  {sim.data.resolved.length} conflict{sim.data.resolved.length === 1 ? '' : 's'} resolved · {sim.data.introduced.length} new conflict{sim.data.introduced.length === 1 ? '' : 's'}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {sim.data.workload.length} family member{sim.data.workload.length === 1 ? '' : 's'} affected
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <ButtonLink to={`/what-if/impact?${query}`} variant="secondary" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                View impact analysis
              </ButtonLink>
              <Button loading={apply.pending} onClick={onApply}>
                Apply to live schedule
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
