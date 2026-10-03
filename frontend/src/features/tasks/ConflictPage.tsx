import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CircleCheckBig, Clock, Lock, Sparkles, Star, UserCheck } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTime, formatTimeRange, formatLongDate } from '@/lib/dates';
import { Avatar, Badge, Button, ButtonLink, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import type { ScheduleEvent } from '@/types/domain';

function OverlapTimeline({ task, others }: { task: { title: string; start: string; end: string }; others: ScheduleEvent[] }) {
  const all = [task, ...others];
  const from = Math.min(...all.map((e) => new Date(e.start).getTime())) - 30 * 60_000;
  const to = Math.max(...all.map((e) => new Date(e.end).getTime())) + 30 * 60_000;
  const pct = (iso: string) => ((new Date(iso).getTime() - from) / (to - from)) * 100;
  const ticks = Array.from({ length: 5 }, (_, i) => new Date(from + ((to - from) * i) / 4).toISOString());
  const overlapMin =
    others.reduce((m, o) => Math.max(m, Math.min(new Date(o.end).getTime(), new Date(task.end).getTime()) - Math.max(new Date(o.start).getTime(), new Date(task.start).getTime())), 0) / 60_000;

  return (
    <div className="rounded-2xl bg-rose-50/70 p-4">
      <div className="mb-3 flex items-center justify-between text-[0.8125rem]">
        <span className="font-semibold text-ink">How they overlap</span>
        {overlapMin > 0 && <span className="font-semibold text-red-600">{Math.round(overlapMin)} min at the same time</span>}
      </div>
      <div className="mb-2 flex justify-between text-[0.6875rem] font-semibold text-ink-subtle">
        {ticks.map((t) => (
          <span key={t}>{formatTime(t)}</span>
        ))}
      </div>
      <div className="space-y-2">
        {others.map((o) => (
          <div key={o.id} className="relative h-8 rounded-lg bg-surface/70">
            <span
              className="absolute inset-y-1 flex items-center overflow-hidden rounded-md bg-primary-200 px-2 text-[0.6875rem] font-semibold text-primary-900"
              style={{ left: `${pct(o.start)}%`, width: `${pct(o.end) - pct(o.start)}%` }}
            >
              <span className="truncate">{o.title}</span>
            </span>
          </div>
        ))}
        <div className="relative h-8 rounded-lg bg-surface/70">
          <span
            className="absolute inset-y-1 flex items-center overflow-hidden rounded-md bg-rose-400 px-2 text-[0.6875rem] font-semibold text-white"
            style={{ left: `${pct(task.start)}%`, width: `${pct(task.end) - pct(task.start)}%` }}
          >
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
  const { nameOf, firstNameOf, memberById, personName, me } = useFamily();

  const data = useAsync(async () => {
    const [task, insight] = await Promise.all([taskService.getTask(taskId), decisionService.getTaskInsight(taskId)]);
    const week = await scheduleService.getWeek(new Date(task.start));
    return { task, insight, week };
  }, [taskId]);
  useDocumentTitle('Sort out a clash');

  const assign = useMutation(taskService.assignTask);
  const keep = useMutation(decisionService.acknowledgeConflict);
  const review = useMutation(decisionService.requestReassignment);

  if (data.status === 'loading' && !data.data) return <PageSkeleton />;
  if (data.status === 'error' || !data.data) return <ErrorState headingLevel="h1" title="We couldn’t load this clash" message={data.error?.message} onRetry={data.reload} />;

  const { task, insight, week } = data.data;
  const conflict = insight.conflict;
  const end = new Date(new Date(task.start).getTime() + task.durationMin * 60_000).toISOString();

  if (!conflict) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: 'My day', to: '/today' }, { label: task.title, to: `/tasks/${task.id}` }, { label: 'Sort out a clash' }]} title="Sort out a clash" />
        <EmptyState
          tone="mint"
          icon={<CircleCheckBig aria-hidden="true" />}
          title="Nothing clashes with this task"
          description={`“${task.title}” is ${task.assigneeId ? `with ${task.assigneeId === me?.id ? 'you' : nameOf(task.assigneeId)}` : 'planned'} and nothing overlaps it.`}
          action={
            <>
              <ButtonLink to={`/tasks/${task.id}`} variant="secondary">
                Open task
              </ButtonLink>
              <ButtonLink to="/today">Back to my day</ButtonLink>
            </>
          }
        />
      </>
    );
  }

  const isPrivate = task.visibility === 'private';
  const overlapping = week.filter((e) => e.id !== task.id && e.memberId === task.assigneeId && new Date(e.start) < new Date(end) && new Date(e.end) > new Date(task.start));
  const [best, ...rest] = insight.candidates;
  const alternatives = rest.filter((c) => c.score >= 40).slice(0, 3);
  const who = (id: string | null) => (id === me?.id ? 'me' : firstNameOf(id));
  const unassigned = conflict.kind === 'unassigned';

  const directAssign = async (memberId: string) => {
    const r = await assign.run(task.id, memberId);
    if (r) {
      toast({ title: `Given to ${who(memberId)}`, description: 'Your family can see the change.' });
      navigate(`/tasks/${task.id}`);
    } else {
      toast({ tone: 'error', title: 'Couldn’t hand it over', description: assign.error ?? undefined });
    }
  };

  const reviewCandidates = async () => {
    const req = await review.run(task.id, conflict.reason);
    if (req) navigate(`/priority/requests/${req.id}`);
    else toast({ tone: 'error', title: 'Couldn’t start the handover', description: review.error ?? undefined });
  };

  const keepAnyway = async () => {
    if (!(await keep.attempt(task.id))) {
      toast({ tone: 'error', title: 'Couldn’t keep the plan', description: keep.error ?? undefined });
      return;
    }
    toast({ title: 'Kept as it is', description: task.title });
    navigate('/today');
  };

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        breadcrumbs={[{ label: 'My day', to: '/today' }, { label: task.title, to: `/tasks/${task.id}` }, { label: 'Sort out a clash' }]}
        title="Sort out a clash"
        meta={<ScorePill kind="priority" score={insight.priority.score} label="Priority score" />}
      />

      <div className="space-y-6">
        <Callout tone="primary" icon={<Sparkles aria-hidden="true" />} title={unassigned ? 'This task needs someone' : 'Two things are planned for the same time'}>
          {conflict.reason} {insight.priority.explanation}
        </Callout>

        <Card>
          <CardHeader title="Side by side" action={<Badge tone="rose">{formatLongDate(task.start)}</Badge>} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="eyebrow text-rose-600">This task</p>
              <p className="mt-1 font-display text-lg">{task.title}</p>
              {task.forId && <p className="mt-1 text-sm text-ink-muted">For {personName(task.forId)}</p>}
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[0.8125rem] font-semibold text-ink">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" /> {formatTimeRange(task.start, end)}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="eyebrow">{unassigned ? 'Who does it' : 'Already planned'}</p>
              <p className="mt-1 font-display text-lg">{conflict.otherLabel ?? (unassigned ? 'Nobody yet' : 'Outside usual hours')}</p>
              <p className="mt-1 text-sm text-ink-muted">{task.assigneeId ? (task.assigneeId === me?.id ? 'Me' : nameOf(task.assigneeId)) : 'Anyone in the family can take it'}</p>
              {overlapping[0] && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[0.8125rem] font-semibold text-ink">
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

        <section aria-labelledby="ways-out">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="ways-out" className="font-display text-xl">
              Ways to sort it out
            </h2>
            <span className="text-[0.8125rem] text-ink-subtle">Choose what works best</span>
          </div>

          {isPrivate ? (
            <Card tone="primary">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-display text-xl">
                    <Lock aria-hidden="true" className="h-5 w-5 text-primary-600" /> Change the time
                  </h3>
                  <p className="mt-1.5 text-sm text-ink-muted">Private tasks can’t be handed over to someone else, so the way out is a time that suits you better.</p>
                </div>
                <ButtonLink to={`/tasks/${task.id}/edit`} size="lg" className="shrink-0" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Change the time
                </ButtonLink>
              </div>
            </Card>
          ) : (
            <>
              {best ? (
                <Card tone="primary" className="relative overflow-hidden">
                  <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-xl bg-mint-600 px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-white">
                    <Star aria-hidden="true" className="h-3 w-3" /> Suggested
                  </span>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 font-display text-xl">
                        <Sparkles aria-hidden="true" className="h-5 w-5 text-primary-600" /> See who can take it
                      </h3>
                      <div className="mt-3 flex items-center gap-3">
                        <Avatar name={nameOf(best.memberId)} seed={best.memberId} />
                        <div>
                          <p className="font-semibold text-ink">
                            {best.memberId === me?.id ? 'Me' : nameOf(best.memberId)} <ScorePill score={best.score} label="Fit for this time" />
                          </p>
                          <p className="text-[0.8125rem] text-ink-muted">{[...best.reasons, ...best.cautions].slice(0, 2).join(' ')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                      <Button size="lg" loading={review.pending} onClick={reviewCandidates} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                        See who can take it
                      </Button>
                      <Button size="lg" variant="secondary" loading={assign.pending} onClick={() => directAssign(best.memberId)}>
                        Give it to {who(best.memberId)} now
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Callout
                  tone="amber"
                  title="Nobody else is free"
                  action={
                    <ButtonLink to={`/tasks/${task.id}/edit`} variant="secondary" className="min-h-11">
                      Change the time
                    </ButtonLink>
                  }
                >
                  Invite more people to your family, move the task to another time, or keep it anyway.
                </Callout>
              )}

              {alternatives.length > 0 && (
                <Card className="mt-4">
                  <CardHeader title="Or give it to someone directly" description="This hands it over straight away, with no review step." as="h3" />
                  <ul className="space-y-2">
                    {alternatives.map((c) => {
                      const m = memberById(c.memberId);
                      return (
                        <li key={c.memberId} className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-3 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Avatar name={m?.name ?? ''} seed={c.memberId} />
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">
                                {c.memberId === me?.id ? 'Me' : m?.name} <ScorePill score={c.score} label="Fit for this time" />
                              </p>
                              <p className="truncate text-[0.8125rem] text-ink-muted">{c.cautions[0] ?? c.reasons[0]}</p>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            className="min-h-11"
                            loading={assign.pending}
                            onClick={() => directAssign(c.memberId)}
                            leftIcon={<UserCheck aria-hidden="true" className="h-4 w-4" />}
                          >
                            Give it to {who(c.memberId)}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </>
          )}

          <Card tone="muted" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-ink">Keep it anyway</h3>
              <p className="text-[0.8125rem] text-ink-muted">
                {unassigned ? 'Hearth will stop flagging that nobody has taken it.' : 'Hearth will stop flagging this clash.'} You can still change the plan later.
              </p>
            </div>
            <Button variant="secondary" size="lg" loading={keep.pending} onClick={keepAnyway}>
              Keep it anyway
            </Button>
          </Card>
        </section>

        {!isPrivate && <p className="text-center text-[0.8125rem] text-ink-subtle">Changes to shared tasks are recorded in the activity log · {formatDayTime(task.start)}</p>}
      </div>
    </>
  );
}
