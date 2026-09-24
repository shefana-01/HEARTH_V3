import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlarmClock, ArrowRightLeft, CalendarClock, CircleCheck, HandHelping, History, Lock, Pencil, RotateCcw, ShieldCheck, Trash2, TriangleAlert, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { appointmentService } from '@/services/care/appointmentService';
import { auditService } from '@/services/audit/auditService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { dayDiff, formatDayTime, formatDuration, formatTime, timeAgo } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { PRIORITIES, TASK_CATEGORIES } from '@/constants/labels';
import { ActionBar, Avatar, Badge, Button, ButtonLink, Callout, Card, CollapsibleCard, ConfirmDialog, Disclosure, ErrorState, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { CategoryIcon } from '@/components/domain/TaskRow';
import { PrivateBadge } from '@/components/domain/People';
import { PriorityBreakdownView, ScorePill } from '@/components/domain/Scores';
import { TaskComments } from './TaskComments';

export default function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { nameOf, firstNameOf, memberById, personName, people, me } = useFamily();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const data = useAsync(async () => {
    const task = await taskService.getTask(taskId);
    const [insight, appointment, audit] = await Promise.all([
      task.status === 'scheduled' ? decisionService.getTaskInsight(taskId) : Promise.resolve(undefined),
      task.appointmentId ? appointmentService.get(task.appointmentId).catch(() => undefined) : Promise.resolve(undefined),
      auditService.list(),
    ]);
    return { task, insight, appointment, history: audit.filter((e) => e.subject === task.title).slice(0, 6) };
  }, [taskId]);
  useDocumentTitle(data.data?.task.title ?? 'Task');

  const complete = useMutation(taskService.completeTask);
  const reopen = useMutation(taskService.reopenTask);
  const cancel = useMutation(taskService.cancelTask);
  const reassign = useMutation(decisionService.requestReassignment);
  const take = useMutation(taskService.assignTask);

  if (data.status === 'loading' && !data.data) return <PageSkeleton />;
  if (data.status === 'error' || !data.data) return <ErrorState headingLevel="h1" title="We couldn’t open this task" message={data.error?.message} onRetry={data.reload} />;

  const { task, insight, appointment, history } = data.data;
  const assignee = memberById(task.assigneeId);
  const forPerson = people.find((p) => p.id === task.forId);
  const isPrivate = task.visibility === 'private';
  const mine = task.assigneeId === me?.id;
  const done = task.status === 'completed';
  const cancelled = task.status === 'cancelled';
  const conflict = insight?.conflict;
  const days = dayDiff(task.start);
  const endIso = new Date(new Date(task.start).getTime() + task.durationMin * 60_000).toISOString();

  const onComplete = async () => {
    const r = await (done ? reopen.run(task.id) : complete.run(task.id));
    if (r) {
      toast({ title: done ? 'Task reopened' : 'Marked as done', description: task.title });
      data.reload();
    }
  };

  const onAskSomeone = async () => {
    const req = await reassign.run(task.id, conflict?.reason ?? `${firstNameOf(task.assigneeId)} asked for someone else to take this task.`);
    if (req) navigate(`/priority/requests/${req.id}`);
    else toast({ tone: 'error', title: 'Couldn’t ask for a handover', description: reassign.error ?? undefined });
  };

  const onTake = async () => {
    if (!me) return;
    const updated = await take.run(task.id, me.id);
    if (updated) {
      toast({ title: 'It’s yours now', description: task.title });
      data.reload();
    } else {
      toast({ tone: 'error', title: 'Couldn’t take this task', description: take.error ?? undefined });
    }
  };

  const onCancel = async () => {
    const ok = await cancel.attempt(task.id);
    setConfirmCancel(false);
    if (!ok) {
      toast({ tone: 'error', title: 'Couldn’t cancel the task', description: cancel.error ?? undefined });
      return;
    }
    toast({ title: 'Task cancelled', description: task.title });
    navigate('/tasks');
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Tasks', to: '/tasks' }, { label: task.title }]}
        title={task.title}
        description={task.notes ? undefined : TASK_CATEGORIES[task.category].label}
        meta={
          <>
            {cancelled ? (
              <Badge tone="neutral" size="md">
                Cancelled
              </Badge>
            ) : done ? (
              <Badge tone="mint" size="md" dot>
                Completed {task.completedAt && timeAgo(task.completedAt)}
              </Badge>
            ) : conflict ? (
              <Badge tone="red" size="md" dot>
                {conflict.kind === 'unassigned' ? 'Needs someone' : 'Clash'}
              </Badge>
            ) : (
              <Badge tone="mint" size="md" dot>
                On track
              </Badge>
            )}
            <Badge tone={PRIORITIES[task.priority].tone} size="md">
              {PRIORITIES[task.priority].label}
            </Badge>
            {!done && !cancelled && days === 0 && (
              <Badge tone="rose" size="md">
                Due today
              </Badge>
            )}
            {isPrivate && <PrivateBadge />}
            {task.forId && (
              <Badge tone="rose" size="md">
                For {personName(task.forId)}
              </Badge>
            )}
          </>
        }
        actions={
          !cancelled && (
            <ButtonLink to={`/tasks/${task.id}/edit`} variant="secondary" leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
              Edit
            </ButtonLink>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {conflict && (
            <Callout
              tone="red"
              icon={<TriangleAlert aria-hidden="true" />}
              title={conflict.kind === 'unassigned' ? 'This task needs someone' : 'This task clashes with something else'}
              action={
                <ButtonLink to={`/tasks/${task.id}/resolve`} className="min-h-11">
                  Sort it out
                </ButtonLink>
              }
            >
              {conflict.reason}
            </Callout>
          )}

          <Card>
            <div className="flex flex-wrap items-center gap-4 border-b border-line pb-5">
              <CategoryIcon category={task.category} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-display text-xl">
                  <AlarmClock aria-hidden="true" className="h-5 w-5 text-primary-600" />
                  {formatDayTime(task.start)}
                </p>
                <p className="text-sm text-ink-muted">
                  {formatTime(task.start)} – {formatTime(endIso)} · {formatDuration(task.durationMin)} · {TASK_CATEGORIES[task.category].label}
                </p>
              </div>
            </div>
            {task.notes && <p className="whitespace-pre-line pt-5 text-[0.9375rem] text-ink">{task.notes}</p>}

            <div className={cn('mt-5 grid gap-3', forPerson && 'sm:grid-cols-2')}>
              <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-4">
                {assignee ? (
                  <Avatar name={assignee.name} seed={assignee.id} />
                ) : (
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-subtle">
                    ?
                  </span>
                )}
                <div className="min-w-0">
                  <p className="eyebrow">Who does it</p>
                  <p className="truncate font-semibold text-ink">{assignee ? (mine ? 'Me' : assignee.name) : 'Needs someone'}</p>
                  {assignee && <p className="truncate text-[0.8125rem] text-ink-subtle">{mine ? assignee.name : assignee.relation || assignee.focus}</p>}
                </div>
              </div>
              {forPerson && (
                <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-4">
                  <Avatar name={forPerson.name} seed={forPerson.id} />
                  <div className="min-w-0">
                    <p className="eyebrow">Who it is for</p>
                    <p className="truncate font-semibold text-ink">{forPerson.id === me?.id ? 'Me' : forPerson.name}</p>
                    <p className="truncate text-[0.8125rem] text-ink-subtle">{forPerson.relation}</p>
                  </div>
                </div>
              )}
            </div>

            {!cancelled && (
              <ActionBar className="lg:mt-5 lg:justify-stretch">
                <Button
                  size="lg"
                  className="sm:flex-1"
                  variant={done ? 'secondary' : 'primary'}
                  loading={complete.pending || reopen.pending}
                  onClick={onComplete}
                  leftIcon={done ? <RotateCcw aria-hidden="true" className="h-4 w-4" /> : <CircleCheck aria-hidden="true" className="h-4 w-4" />}
                >
                  {done ? 'Reopen' : 'Mark done'}
                </Button>
                {!done && !isPrivate && mine && !insight?.openRequestId && (
                  <Button
                    size="lg"
                    variant="soft"
                    className="sm:flex-1 lg:flex-none"
                    loading={reassign.pending}
                    onClick={onAskSomeone}
                    leftIcon={<ArrowRightLeft aria-hidden="true" className="h-4 w-4" />}
                  >
                    Ask someone to take this
                  </Button>
                )}
                {!done && !isPrivate && insight?.openRequestId && (
                  <ButtonLink
                    to={`/priority/requests/${insight.openRequestId}`}
                    size="lg"
                    variant="soft"
                    className="sm:flex-1 lg:flex-none"
                    leftIcon={<Users aria-hidden="true" className="h-4 w-4" />}
                  >
                    See who can take it
                  </ButtonLink>
                )}
                {!done && !isPrivate && !mine && (
                  <Button size="lg" variant="secondary" className="sm:flex-1 lg:flex-none" loading={take.pending} onClick={onTake} leftIcon={<HandHelping aria-hidden="true" className="h-4 w-4" />}>
                    I’ll take it
                  </Button>
                )}
              </ActionBar>
            )}
            {isPrivate && !cancelled && (
              <p className="mt-4 flex items-center gap-2 text-[0.8125rem] text-ink-muted">
                <Lock aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
                Private tasks stay with you.
              </p>
            )}
          </Card>

          {appointment && (
            <CollapsibleCard
              title="Linked appointment"
              icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />}
              description="This visit depends on the task being done."
              meta={formatDayTime(appointment.start)}
            >
              <Link to={`/appointments/${appointment.id}`} className="block rounded-2xl bg-primary-50 p-4 hover:bg-primary-100">
                <p className="font-semibold text-ink">{appointment.title}</p>
                <p className="text-sm text-ink-muted">
                  {appointment.provider} · {formatDayTime(appointment.start)}
                </p>
              </Link>
            </CollapsibleCard>
          )}

          {!isPrivate && <TaskComments taskId={task.id} />}

          <Disclosure title="Activity history" icon={<History />} meta={`${history.length} event${history.length === 1 ? '' : 's'}`}>
            {history.length ? (
              <ol className="space-y-3">
                {history.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-ink">
                      <span className="font-semibold">{nameOf(e.actorId)}</span> — {e.action.toLowerCase()}
                      {e.after && (
                        <span className="text-ink-muted">
                          {' '}
                          ({e.before ? `${e.before} → ` : ''}
                          {e.after})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-subtle">{timeAgo(e.at)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No changes recorded yet.</p>
            )}
          </Disclosure>
        </div>

        {insight && (
          <aside className="space-y-4">
            <CollapsibleCard title="Priority score" expandFrom="xl" action={<ScorePill kind="priority" score={insight.priority.score} label="Priority score" />} meta={`${insight.priority.score}/100`}>
              <p className="mb-4 text-sm text-ink-muted">{insight.priority.explanation}</p>
              <PriorityBreakdownView priority={insight.priority} />
            </CollapsibleCard>
            {!isPrivate && insight.candidates[0] && (
              <Card tone="mint">
                <p className="eyebrow text-mint-700">Best person to take it right now</p>
                <p className="mt-1 font-semibold text-ink">
                  {nameOf(insight.candidates[0].memberId)} · {insight.candidates[0].score}/100
                </p>
                <p className="mt-1 text-[0.8125rem] text-mint-800">{insight.candidates[0].reasons[0] ?? insight.candidates[0].cautions[0]}</p>
              </Card>
            )}
          </aside>
        )}
      </div>

      {!cancelled && (
        <Card tone="muted" padding="sm" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[0.8125rem] text-ink-muted">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
            {isPrivate ? 'A cancelled private task is simply removed from your list.' : 'Cancelled tasks stay in the activity history, and your family can see that it was cancelled.'}
          </p>
          <Button variant="danger-ghost" className="min-h-11" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setConfirmCancel(true)}>
            Cancel task
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this task?"
        description={isPrivate ? `“${task.title}” will be removed from your schedule.` : `“${task.title}” will be removed from everyone’s schedule. This is recorded in the activity history.`}
        confirmLabel="Cancel task"
        cancelLabel="Keep task"
        variant="danger"
        loading={cancel.pending}
        onConfirm={onCancel}
      />
    </>
  );
}
