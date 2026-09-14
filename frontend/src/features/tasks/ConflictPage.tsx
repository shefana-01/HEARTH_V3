import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CircleCheckBig, Clock, Leaf, Sparkles, Star, UserCheck } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTime, formatTimeRange, formatLongDate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Button, ButtonLink, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import type { ScheduleEvent } from '@/types/domain';

function OverlapTimeline({ task, others }: { task: { title: string; start: string; end: string }; others: ScheduleEvent[] }) {
  const all = [task, ...others];
  const from = Math.min(...all.map((e) => new Date(e.start).getTime())) - 30 * 60_000;
  const to = Math.max(...all.map((e) => new Date(e.end).getTime())) + 30 * 60_000;
  const pct = (iso: string) => ((new Date(iso).getTime() - from) / (to - from)) * 100;
  const ticks = Array.from({ length: 5 }, (_, i) => new Date(from + ((to - from) * i) / 4).toISOString());
  const overlapMin = others.reduce((m, o) => Math.max(m, Math.min(new Date(o.end).getTime(), new Date(task.end).getTime()) - Math.max(new Date(o.start).getTime(), new Date(task.start).getTime())), 0) / 60_000;

  return (
    <div className="rounded-2xl bg-rose-50/70 p-4">
      <div className="mb-3 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-ink">Timeline overlap</span>
        {overlapMin > 0 && <span className="font-semibold text-red-600">{Math.round(overlapMin)} min overlap</span>}
      </div>
      <div className="mb-2 flex justify-between text-[11px] font-semibold text-ink-subtle">
        {ticks.map((t) => (
          <span key={t}>{formatTime(t)}</span>
        ))}
      </div>
      <div className="space-y-2">
        {others.map((o) => (
          <div key={o.id} className="relative h-8 rounded-lg bg-surface/70">
            <span className="absolute inset-y-1 flex items-center overflow-hidden rounded-md bg-primary-200 px-2 text-[11px] font-semibold text-primary-900" style={{ left: `${pct(o.start)}%`, width: `${pct(o.end) - pct(o.start)}%` }}>
              <span className="truncate">{o.title}</span>
            </span>
          </div>
        ))}
        <div className="relative h-8 rounded-lg bg-surface/70">
          <span className="absolute inset-y-1 flex items-center overflow-hidden rounded-md bg-rose-400 px-2 text-[11px] font-semibold text-white" style={{ left: `${pct(task.start)}%`, width: `${pct(task.end) - pct(task.start)}%` }}>
            <span className="truncate">{task.title}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ConflictPage() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { family, nameOf, firstNameOf, memberById } = useFamily();

  const data = useAsync(async () => {
    const [task, insight] = await Promise.all([taskService.getTask(taskId), decisionService.getTaskInsight(taskId)]);
    const week = await scheduleService.getWeek(new Date(task.start));
    return { task, insight, week };
  }, [taskId]);
  useDocumentTitle('Resolve conflict');

  const assign = useMutation(taskService.assignTask);
  const keep = useMutation(decisionService.acknowledgeConflict);
  const review = useMutation(decisionService.requestReassignment);

  if (data.status === 'loading' && !data.data) return <PageSkeleton />;
  if (data.status === 'error' || !data.data) return <ErrorState headingLevel="h1" title="We couldn’t load this conflict" message={data.error?.message} onRetry={data.reload} />;

  const { task, insight, week } = data.data;
  const conflict = insight.conflict;
  const end = new Date(new Date(task.start).getTime() + task.durationMin * 60_000).toISOString();

  if (!conflict) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: 'Overview', to: '/dashboard' }, { label: task.title, to: `/tasks/${task.id}` }, { label: 'Resolve' }]} title="Conflict resolution" />
        <EmptyState
          tone="mint"
          icon={<CircleCheckBig aria-hidden="true" />}
          title="This task has no conflict"
          description={`${task.title} is ${task.assigneeId ? `with ${nameOf(task.assigneeId)}` : 'scheduled'} and nothing overlaps it.`}
          action={
            <>
              <ButtonLink to={`/tasks/${task.id}`} variant="secondary">
                Open task
              </ButtonLink>
              <ButtonLink to="/dashboard">Back to overview</ButtonLink>
            </>
          }
        />
      </>
    );
  }

  const overlapping = week.filter(
    (e) => e.id !== task.id && e.memberId === task.assigneeId && new Date(e.start) < new Date(end) && new Date(e.end) > new Date(task.start),
  );
  const [best, ...rest] = insight.candidates;
  const alternatives = rest.filter((c) => c.score >= 40).slice(0, 3);

  const directAssign = async (memberId: string) => {
    const r = await assign.run(task.id, memberId);
    if (r) {
      toast({ title: `Assigned to ${firstNameOf(memberId)}`, description: 'The circle has been updated.' });
      navigate(`/tasks/${task.id}`);
    }
  };

  const reviewCandidates = async () => {
    const req = await review.run(task.id, conflict.reason);
    if (req) navigate(`/priority/requests/${req.id}`);
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Leaf aria-hidden="true" className="h-3.5 w-3.5" /> Care harmonizer
          </span>
        }
        breadcrumbs={[{ label: 'Overview', to: '/dashboard' }, { label: 'Needs attention', to: '/priority' }, { label: task.title }]}
        title="Conflict resolution"
        meta={<ScorePill score={insight.priority.score} label="Priority score" />}
      />

      <div className="space-y-6">
        <Callout tone="primary" icon={<Sparkles aria-hidden="true" />} title={conflict.kind === 'unassigned' ? 'This task has no owner yet' : 'A scheduling problem was found'}>
          {conflict.reason} {insight.priority.explanation}
        </Callout>

        <Card>
          <CardHeader title="Schedule comparison" action={<Badge tone="rose">{formatLongDate(task.start)}</Badge>} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="eyebrow text-rose-600">Task affected</p>
              <p className="mt-1 font-display text-lg">{task.title}</p>
              <p className="mt-1 text-sm text-ink-muted">For {family?.recipient.name}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[13px] font-semibold text-ink">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" /> {formatTimeRange(task.start, end)}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="eyebrow">{conflict.kind === 'unassigned' ? 'Assignment' : 'Existing commitment'}</p>
              <p className="mt-1 font-display text-lg">{conflict.otherLabel ?? (conflict.kind === 'unassigned' ? 'Nobody assigned' : 'Outside usual hours')}</p>
              <p className="mt-1 text-sm text-ink-muted">{task.assigneeId ? nameOf(task.assigneeId) : 'Anyone in the circle can take it'}</p>
              {overlapping[0] && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[13px] font-semibold text-ink">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" /> {formatTimeRange(overlapping[0].start, overlapping[0].end)}
                </p>
              )}
            </div>
          </div>
          {overlapping.length > 0 && (
            <div className="mt-4">
              <OverlapTimeline task={{ title: task.title, start: task.start, end }} others={overlapping} />
            </div>
          )}
        </Card>

        <section aria-labelledby="next-steps">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="next-steps" className="font-display text-xl">
              Next steps
            </h2>
            <span className="text-[13px] text-ink-subtle">Choose what works best for the family</span>
          </div>

          {best ? (
            <Card tone="primary" className="relative overflow-hidden">
              <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-xl bg-mint-600 px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-white">
                <Star aria-hidden="true" className="h-3 w-3" /> Recommended
              </span>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-display text-xl">
                    <Sparkles aria-hidden="true" className="h-5 w-5 text-primary-600" /> Reassign with smart match
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar name={nameOf(best.memberId)} seed={best.memberId} />
                    <div>
                      <p className="font-semibold text-ink">
                        {nameOf(best.memberId)} <ScorePill score={best.score} label="Suitability" />
                      </p>
                      <p className="text-[13px] text-ink-muted">{[...best.reasons, ...best.cautions].slice(0, 2).join(' ')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                  <Button loading={review.pending} onClick={reviewCandidates} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                    Review available caregivers
                  </Button>
                  <Button variant="secondary" loading={assign.pending} onClick={() => directAssign(best.memberId)}>
                    Assign {firstNameOf(best.memberId)} now
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Callout tone="amber" title="Nobody else is available">
              Invite more people to your circle, or keep the task and adjust its time.
            </Callout>
          )}

          {alternatives.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Or choose someone directly" description="Assigns immediately without a review step." as="h3" />
              <ul className="space-y-2">
                {alternatives.map((c) => {
                  const m = memberById(c.memberId);
                  return (
                    <li key={c.memberId} className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={m?.name ?? ''} seed={c.memberId} />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {m?.name} <ScorePill score={c.score} label="Suitability" />
                          </p>
                          <p className="truncate text-[13px] text-ink-muted">{c.cautions[0] ?? c.reasons[0]}</p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" loading={assign.pending} onClick={() => directAssign(c.memberId)} leftIcon={<UserCheck aria-hidden="true" className="h-4 w-4" />}>
                        Assign {m?.name.split(' ')[0]}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card tone="muted" className={cn('mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}>
            <div>
              <h3 className="font-semibold text-ink">{conflict.kind === 'unassigned' ? 'Leave it open for now' : `Keep ${firstNameOf(task.assigneeId)} on this task`}</h3>
              <p className="text-[13px] text-ink-muted">Hearth will stop flagging this conflict. You can still change it later.</p>
            </div>
            <Button
              variant="secondary"
              loading={keep.pending}
              onClick={async () => {
                await keep.run(task.id);
                toast({ title: 'Plan kept as it is', description: task.title });
                navigate('/dashboard');
              }}
            >
              Keep current plan
            </Button>
          </Card>
        </section>

        <p className="text-center text-[13px] text-ink-subtle">Every change is recorded in Activity & audit · {formatDayTime(task.start)}</p>
      </div>
    </>
  );
}
