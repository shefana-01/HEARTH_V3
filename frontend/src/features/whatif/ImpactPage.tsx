import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheckBig, FlaskConical, PauseCircle, Pencil, ShieldCheck, Trash2, TriangleAlert, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatDuration } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { ActionBar, Avatar, Badge, Button, ButtonLink, Callout, Card, CardHeader, Checkbox, EmptyState, ErrorState, PageHeader, PageSkeleton, ProgressBar, useToast } from '@/components/ui';
import { useSimulationParams } from './useSimulationParams';
import { SimulatorTabs } from './SimulatorTabs';

export default function ImpactPage() {
  useDocumentTitle('What-if impact analysis');
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
        title="No simulation to analyse"
        description="Set up a change in the simulator first."
        action={<ButtonLink to="/what-if">Open the simulator</ButtonLink>}
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
      toast({ title: 'Changes applied', description: `${nameOf(r.assigneeId)} · ${formatDayTime(r.start)}` });
      navigate(`/tasks/${r.id}`);
    }
  };

  return (
    <>
      <Callout
        tone="rose"
        icon={<FlaskConical aria-hidden="true" />}
        className="mb-6"
        title="Simulation — no changes have been applied"
        action={
          <ButtonLink to={`/what-if?${query}`} size="sm" variant="secondary">
            Back to simulator
          </ButtonLink>
        }
      >
        This analysis uses your circle’s current schedule, availability and reported time away.
      </Callout>

      <PageHeader
        breadcrumbs={[{ label: 'What-if simulator', to: `/what-if?${query}` }, { label: 'Impact analysis' }]}
        title="What-if impact analysis"
        description="How this change would affect conflicts, workloads and the rest of the circle."
        actions={
          <Card padding="sm" className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" className={cn('h-8 w-8', safe ? 'text-mint-600' : 'text-amber-600')} />
            <div>
              <p className="eyebrow">Routine safety index</p>
              <p className="font-display text-2xl">{safetyIndex}%</p>
            </div>
          </Card>
        }
      />
      <SimulatorTabs active="impact" query={query} hasChange={hasChange} />

      <Card className="mb-6">
        <Badge tone="primary" className="mb-2">
          Simulated scenario
        </Badge>
        <p className="font-display text-xl">
          “{task.title}” → {nameOf(newAssignee)}, {formatDayTime(newStart)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Currently {nameOf(task.assigneeId)}, {formatDayTime(task.start)} · {formatDuration(task.durationMin)}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card tone="mint">
          <CardHeader title="Resolved" icon={<CircleCheckBig aria-hidden="true" className="h-5 w-5" />} action={<Badge tone="mint">{result.resolved.length} fixed</Badge>} />
          {result.resolved.length ? (
            <ul className="space-y-2">
              {result.resolved.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface/80 p-3 text-sm">
                  <p className="font-semibold text-ink">{c.kind === 'unassigned' ? 'Task now has an owner' : 'Conflict removed'}</p>
                  <p className="text-[13px] text-ink-muted">{c.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mint-800">This change doesn’t fix an existing conflict.</p>
          )}
        </Card>

        <Card tone={safe ? 'primary' : 'red'}>
          <CardHeader
            title="Conflict check"
            icon={safe ? <ShieldCheck aria-hidden="true" className="h-5 w-5" /> : <TriangleAlert aria-hidden="true" className="h-5 w-5" />}
            action={<Badge tone={safe ? 'mint' : 'red'}>{safe ? 'Passed' : `${result.introduced.length} new`}</Badge>}
          />
          {safe ? (
            <>
              <p className="font-display text-lg">No new conflicts introduced</p>
              <ul className="mt-3 grid gap-2 text-[13px] text-ink-muted sm:grid-cols-2">
                {[
                  'No double-booking',
                  'Reported time away respected',
                  'Within usual availability',
                  `${result.conflictsAfter.length} other open issue${result.conflictsAfter.length === 1 ? '' : 's'} unchanged`,
                ].map((t) => (
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
          <CardHeader title="Workload changes" icon={<Users aria-hidden="true" className="h-5 w-5" />} description="Minutes of care on the day, before and after." />
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
                    <p className="mt-2 text-[13px] text-ink-muted">
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
          <CardHeader title="Unaffected" icon={<PauseCircle aria-hidden="true" className="h-5 w-5" />} action={<Badge>{unaffected.length} stable</Badge>} />
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
          label="I’ve reviewed this change — notify the people affected when it’s applied"
          description="They’ll get a quiet update in Hearth. Applying is recorded in the activity history."
        />
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="danger-ghost" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => navigate('/what-if')}>
            Discard simulation
          </Button>
          <ActionBar className="flex-row">
            <ButtonLink to={`/what-if?${query}`} variant="secondary" leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
              Edit
            </ButtonLink>
            <Button className="flex-1 sm:flex-none" disabled={!confirmed} loading={apply.pending} onClick={onApply}>
              Apply changes
            </Button>
          </ActionBar>
        </div>
      </Card>
    </>
  );
}
