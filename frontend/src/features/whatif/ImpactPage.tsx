import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheckBig, FlaskConical, PauseCircle, Pencil, ShieldCheck, Trash2, TriangleAlert, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatDuration } from '@/lib/dates';
import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ActionBar, Avatar, Badge, Button, ButtonLink, Callout, Card, CardHeader, Checkbox, EmptyState, ErrorState, PageHeader, PageSkeleton, ProgressBar, useToast } from '@/components/ui';
import { useSimulationParams } from './useSimulationParams';
import { SimulatorTabs } from './SimulatorTabs';

export default function ImpactPage() {
  useDocumentTitle('What the change would do');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { members, nameOf, firstNameOf } = useFamily();
  const { change, query, hasChange } = useSimulationParams();
  const [confirmed, setConfirmed] = useState(false);
  const data = useAsync(async () => {
    if (!change || !hasChange) return null;
    const [task, result] = await Promise.all([taskService.getTask(change.taskId), decisionService.simulate(change)]);
    return { task, result };
  }, [query]);
  const apply = useMutation(decisionService.applySimulation);

  if (!change || !hasChange) {
    return (
      <EmptyState
        headingLevel="h1"
        icon={<FlaskConical aria-hidden="true" />}
        title="Nothing to look at yet"
        description="Try a change in the what-if planner first."
        action={<ButtonLink to="/what-if">Open the what-if planner</ButtonLink>}
      />
    );
  }
  if (data.status === 'loading' && !data.data) return <PageSkeleton />;
  if (data.status === 'error' || !data.data) return <ErrorState headingLevel="h1" message={data.error?.message} onRetry={data.reload} />;

  const { task, result } = data.data;
  const newAssignee = change.assigneeId !== undefined ? change.assigneeId : task.assigneeId;
  const newStart = change.start ?? task.start;
  const changedIds = new Set(result.workload.map((w) => w.memberId));
  const unaffected = members.filter((m) => m.status === 'active' && m.role !== 'observer' && !changedIds.has(m.id));
  const safe = result.introduced.length === 0;
  const safetyIndex = Math.max(0, 100 - result.introduced.length * 35 - result.conflictsAfter.length * 10);

  const onApply = async () => {
    const r = await apply.run(change);
    if (r) {
      toast({ title: 'Change applied', description: `${r.assigneeId ? nameOf(r.assigneeId) : 'Needs someone'} · ${formatDayTime(r.start)}` });
      navigate(`/tasks/${r.id}`);
    }
  };

  return (
    <>
      <Callout
        tone="rose"
        icon={<FlaskConical aria-hidden="true" />}
        className="mb-6"
        title="Just trying things out. Nothing has changed."
        action={
          <ButtonLink to={`/what-if?${query}`} size="sm" variant="secondary">
            Back to the planner
          </ButtonLink>
        }
      >
        This uses your family’s current schedule, when people are free and any time away.
      </Callout>

      <PageHeader
        breadcrumbs={[{ label: 'What-if planner', to: `/what-if?${query}` }, { label: 'What it would change' }]}
        title="What it would change"
        description="How this change would affect clashes, workloads and the rest of the family."
        actions={
          <Card padding="sm" className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" className={cn('h-8 w-8', safe ? 'text-mint-600' : 'text-amber-600')} />
            <div>
              <p className="eyebrow">Plan health</p>
              <p className="font-display text-2xl">{safetyIndex}%</p>
            </div>
          </Card>
        }
      />
      <SimulatorTabs active="impact" query={query} hasChange={hasChange} />

      <Card className="mb-6">
        <Badge tone="primary" className="mb-2">
          What you are trying
        </Badge>
        <p className="font-display text-xl">
          “{task.title}” → {newAssignee ? nameOf(newAssignee) : 'Nobody yet'}, {formatDayTime(newStart)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Now with {task.assigneeId ? nameOf(task.assigneeId) : 'nobody'}, {formatDayTime(task.start)} · {formatDuration(task.durationMin)}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card tone="mint">
          <CardHeader title="Fixed" icon={<CircleCheckBig aria-hidden="true" className="h-5 w-5" />} action={<Badge tone="mint">{result.resolved.length} fixed</Badge>} />
          {result.resolved.length ? (
            <ul className="space-y-2">
              {result.resolved.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface/80 p-3 text-sm">
                  <p className="font-semibold text-ink">{c.kind === 'unassigned' ? 'The task now has someone' : 'Clash removed'}</p>
                  <p className="text-[0.8125rem] text-ink-muted">{c.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mint-800">This change doesn’t fix a clash that is there now.</p>
          )}
        </Card>

        <Card tone={safe ? 'primary' : 'red'}>
          <CardHeader
            title="Clash check"
            icon={safe ? <ShieldCheck aria-hidden="true" className="h-5 w-5" /> : <TriangleAlert aria-hidden="true" className="h-5 w-5" />}
            action={<Badge tone={safe ? 'mint' : 'red'}>{safe ? 'Passed' : `${result.introduced.length} new`}</Badge>}
          />
          {safe ? (
            <>
              <p className="font-display text-lg">No new clashes</p>
              <ul className="mt-3 grid gap-2 text-[0.8125rem] text-ink-muted sm:grid-cols-2">
                {['No double-booking', 'Time away respected', 'Within usual hours', `${plural(result.conflictsAfter.length, 'other open clash', 'other open clashes')} unchanged`].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CircleCheckBig aria-hidden="true" className="h-3.5 w-3.5 text-mint-600" /> {t}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="space-y-2">
              {result.introduced.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface/80 p-3 text-sm text-red-700">
                  {c.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader title="Workload changes" icon={<Users aria-hidden="true" className="h-5 w-5" />} description="Minutes of tasks on that day, before and after." />
          {result.workload.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.workload.map((w) => {
                const delta = w.after - w.before;
                return (
                  <li key={w.memberId} className="rounded-2xl bg-surface-muted p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <Avatar name={nameOf(w.memberId)} seed={w.memberId} size="sm" />
                        {firstNameOf(w.memberId)}
                      </span>
                      <Badge tone={delta > 0 ? 'amber' : delta < 0 ? 'mint' : 'neutral'}>
                        {delta > 0 ? '+' : ''}
                        {delta} min
                      </Badge>
                    </div>
                    <p className="mt-2 text-[0.8125rem] text-ink-muted">
                      {formatDuration(w.before || 0)} → {formatDuration(w.after || 0)}
                    </p>
                    <ProgressBar value={w.after} max={240} tone={w.after > 240 ? 'red' : 'primary'} label={`${firstNameOf(w.memberId)} load after change`} className="mt-2" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">No workload changes.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Not affected" icon={<PauseCircle aria-hidden="true" className="h-5 w-5" />} action={<Badge>{unaffected.length} unchanged</Badge>} />
          <ul className="space-y-2">
            {unaffected.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-ink">
                <Avatar name={m.name} seed={m.id} size="xs" /> {m.name}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <Checkbox
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          label={task.visibility === 'family' ? 'I’ve looked at this change. Tell the people affected when it’s applied.' : 'I’ve looked at this change.'}
          description={task.visibility === 'family' ? 'They’ll get a quiet update in Hearth, and Activity will show the change.' : 'Only you can see this task, so nobody else is told.'}
        />
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="danger-ghost" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => navigate('/what-if')}>
            Throw it away
          </Button>
          <ActionBar className="flex-row">
            <ButtonLink to={`/what-if?${query}`} variant="secondary" leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
              Change it
            </ButtonLink>
            <Button className="flex-1 sm:flex-none" disabled={!confirmed} loading={apply.pending} onClick={onApply}>
              Apply the change
            </Button>
          </ActionBar>
        </div>
      </Card>
    </>
  );
}
