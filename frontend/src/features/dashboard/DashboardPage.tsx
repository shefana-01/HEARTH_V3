import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarPlus, CalendarX2, CircleCheckBig, HeartHandshake, Plus, Sparkles, Stethoscope, Sun } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService, type AttentionItem } from '@/services/decision/decisionService';
import { appointmentService } from '@/services/care/appointmentService';
import { auditService } from '@/services/audit/auditService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatLongDate, formatTimeRange, greeting, isSameDay, timeAgo } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, ListSkeleton, PageHeader, ProgressBar, SectionHeader, Skeleton, useToast } from '@/components/ui';
import { TaskRow } from '@/components/domain/TaskRow';
import { ScorePill } from '@/components/domain/Scores';
import type { CareTask, Unavailability } from '@/types/domain';

function AttentionCard({ item }: { item: AttentionItem }) {
  const { firstNameOf } = useFamily();
  const navigate = useNavigate();
  const { toast } = useToast();
  const quick = useMutation(decisionService.requestReassignment);
  const top = item.topCandidate;
  const unassigned = item.conflict.kind === 'unassigned';

  const quickReassign = async () => {
    if (!top) return;
    const req = await quick.run(item.task.id, item.conflict.reason);
    if (req) navigate(`/priority/requests/${req.id}/approve/${top.memberId}`);
    else toast({ tone: 'error', title: 'Couldn’t start the reassignment', description: quick.error ?? undefined });
  };

  return (
    <li className={cn('rounded-2xl border p-4 sm:p-5', item.priority.score >= 70 ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/60')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={item.priority.score >= 70 ? 'red' : 'amber'}>{unassigned ? 'Needs an owner' : 'Schedule conflict'}</Badge>
            <ScorePill score={item.priority.score} label="Priority score" />
          </div>
          <h3 className="font-display text-lg leading-snug">{item.task.title}</h3>
          <p className="mt-1 text-sm text-ink-muted">{item.conflict.reason}</p>
          <p className="mt-2 text-[13px] font-medium text-ink-subtle">{formatDayTime(item.task.start)}</p>
          {top && top.score >= 50 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-[13px] text-ink">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary-600" />
              Suggested: <span className="font-semibold">{firstNameOf(top.memberId)}</span> · {top.score}/100
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
          <ButtonLink to={`/tasks/${item.task.id}/resolve`} size="sm" variant="primary" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Resolve
          </ButtonLink>
          {top && top.score >= 50 && (
            <Button size="sm" variant="secondary" loading={quick.pending} onClick={quickReassign}>
              Quick reassign
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function CoverageTimeline({ tasks, absences, conflictIds }: { tasks: CareTask[]; absences: Unavailability[]; conflictIds: Set<string> }) {
  const { members, firstNameOf } = useFamily();
  const START = 7;
  const END = 22;
  const span = (END - START) * 60;
  const pos = (iso: string) => {
    const d = new Date(iso);
    return Math.max(0, Math.min(1, (d.getHours() * 60 + d.getMinutes() - START * 60) / span));
  };
  const active = members.filter((m) => m.status === 'active' && m.role !== 'observer');

  return (
    <div>
      <div className="mb-2 grid grid-cols-[4.5rem_1fr] text-[11px] font-semibold text-ink-subtle">
        <span />
        <div className="flex justify-between">
          {['7 AM', '11 AM', '3 PM', '7 PM', '10 PM'].map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
      <ul className="space-y-2.5">
        {active.map((m) => {
          const mine = tasks.filter((t) => t.assigneeId === m.id && t.status !== 'cancelled');
          const away = absences.filter((u) => u.memberId === m.id);
          return (
            <li key={m.id} className="grid grid-cols-[4.5rem_1fr] items-center">
              <span className="truncate text-[13px] font-medium text-ink">{firstNameOf(m.id)}</span>
              <div className="relative h-4 rounded-full bg-surface-sunken">
                {away.map((u) => (
                  <span
                    key={u.id}
                    title={`Unavailable ${formatTimeRange(u.start, u.end)}`}
                    className="absolute inset-y-0 rounded-full bg-[repeating-linear-gradient(45deg,theme(colors.rose.200),theme(colors.rose.200)_4px,theme(colors.rose.100)_4px,theme(colors.rose.100)_8px)]"
                    style={{ left: `${pos(u.start) * 100}%`, width: `${Math.max(2, (pos(u.end) - pos(u.start)) * 100)}%` }}
                  />
                ))}
                {mine.map((t) => {
                  const end = new Date(new Date(t.start).getTime() + t.durationMin * 60_000).toISOString();
                  return (
                    <span
                      key={t.id}
                      title={`${t.title} · ${formatTimeRange(t.start, end)}`}
                      className={cn('absolute inset-y-0.5 rounded-full', conflictIds.has(t.id) ? 'bg-red-400' : t.status === 'completed' ? 'bg-mint-400' : 'bg-primary-400')}
                      style={{ left: `${pos(t.start) * 100}%`, width: `${Math.max(2, (pos(end) - pos(t.start)) * 100)}%` }}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-primary-400" /> Planned
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-mint-400" /> Done
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-red-400" /> Conflict
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-rose-200" /> Unavailable
        </li>
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Overview');
  const { family, members, me, nameOf } = useFamily();
  const { toast } = useToast();

  const data = useAsync(() => Promise.all([taskService.listTasks(), decisionService.listAttention(), appointmentService.list(), auditService.list(), scheduleService.listUnavailability()]), []);
  const toggle = useMutation((t: CareTask) => (t.status === 'completed' ? taskService.reopenTask(t.id) : taskService.completeTask(t.id)));

  const [tasks = [], attention = [], appointments = [], audit = [], absences = []] = data.data ?? [];
  const today = tasks.filter((t) => isSameDay(t.start, new Date()));
  const doneToday = today.filter((t) => t.status === 'completed').length;
  const conflictIds = new Set(attention.map((a) => a.task.id));
  const nextVisit = appointments.find((a) => new Date(a.start).getTime() + a.durationMin * 60_000 > Date.now());
  const todayAbsences = absences.filter((u) => isSameDay(u.start, new Date()) || isSameDay(u.end, new Date()));

  const onToggle = async (task: CareTask) => {
    const updated = await toggle.run(task);
    if (!updated) {
      toast({ tone: 'error', title: 'Couldn’t update the task', description: toggle.error ?? undefined });
      return;
    }
    if (updated.status === 'completed') toast({ title: 'Nice work', description: `“${updated.title}” is done. The circle can see it.` });
    data.reload();
  };

  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Sun aria-hidden="true" className="h-3.5 w-3.5" />
            {formatLongDate(new Date())}
          </span>
        }
        title={`${greeting()}, ${me?.name.split(' ')[0] ?? 'there'}`}
        description={`${family?.name} · ${activeCount} active member${activeCount === 1 ? '' : 's'}`}
        meta={
          <Badge tone="rose" size="md">
            Caring for {family?.recipient.name}
          </Badge>
        }
        actions={
          <>
            <ButtonLink to="/tasks/new" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              Create task
            </ButtonLink>
            <ButtonLink to="/schedule/unavailable" variant="soft" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
              Report unavailability
            </ButtonLink>
            <ButtonLink to="/appointments/new" variant="secondary" leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}>
              Add appointment
            </ButtonLink>
          </>
        }
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-8">
            <section aria-labelledby="attention-heading">
              <SectionHeader
                id="attention-heading"
                title="Needs your attention"
                count={data.data ? attention.length : undefined}
                aside={
                  attention.length > 3 && (
                    <Link to="/priority" className="font-semibold text-primary-700 hover:underline">
                      See all
                    </Link>
                  )
                }
              />
              {!data.data ? (
                <ListSkeleton rows={2} />
              ) : attention.length ? (
                <ul className="space-y-3">
                  {attention.slice(0, 3).map((item) => (
                    <AttentionCard key={item.conflict.id} item={item} />
                  ))}
                </ul>
              ) : (
                <Card tone="mint" className="flex items-center gap-4">
                  <CircleCheckBig aria-hidden="true" className="h-8 w-8 shrink-0 text-mint-600" />
                  <div>
                    <p className="font-semibold text-mint-800">All clear</p>
                    <p className="text-sm text-mint-700">No conflicts or unassigned tasks right now.</p>
                  </div>
                </Card>
              )}
            </section>

            <section aria-labelledby="today-heading">
              <SectionHeader id="today-heading" title="Today’s care tasks" aside={data.data && today.length > 0 && `${doneToday} of ${today.length} done`} />
              {!data.data ? (
                <ListSkeleton rows={4} />
              ) : today.length ? (
                <>
                  <ProgressBar value={doneToday} max={today.length} tone="mint" label="Tasks completed today" className="mb-4" />
                  <ul className="space-y-2.5">
                    {today.map((t) => (
                      <TaskRow key={t.id} task={t} conflict={attention.find((a) => a.task.id === t.id)?.conflict} onToggle={onToggle} pending={toggle.pending} />
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState
                  icon={<HeartHandshake aria-hidden="true" />}
                  title="Nothing planned for today"
                  description="Add the day’s medication, meals, walks or errands so the whole circle can see them."
                  action={
                    <ButtonLink to="/tasks/new" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
                      Create a task
                    </ButtonLink>
                  }
                />
              )}
            </section>

            {family?.recipient.careNotes && (
              <Card tone="rose" className="flex gap-4">
                <HeartHandshake aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-500" />
                <div>
                  <p className="font-display text-lg">About {family.recipient.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{family.recipient.careNotes}</p>
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader
                title="Upcoming visit"
                icon={<Stethoscope aria-hidden="true" className="h-5 w-5" />}
                action={
                  <Link to="/appointments" className="text-[13px] font-semibold text-primary-700 hover:underline">
                    All
                  </Link>
                }
              />
              {!data.data ? (
                <Skeleton className="h-28" />
              ) : nextVisit ? (
                <Link to={`/appointments/${nextVisit.id}`} className="block rounded-2xl bg-primary-50 p-4 hover:bg-primary-100">
                  <p className="font-semibold text-ink">{nextVisit.title}</p>
                  <p className="text-sm text-ink-muted">{nextVisit.provider}</p>
                  <p className="mt-2 text-[13px] font-semibold text-primary-800">{formatDayTime(nextVisit.start)}</p>
                  {nextVisit.prep.length > 0 && (
                    <>
                      <ProgressBar value={nextVisit.prep.filter((p) => p.done).length} max={nextVisit.prep.length} label="Preparation" className="mt-3" />
                      <p className="mt-1.5 text-xs text-ink-subtle">
                        {nextVisit.prep.filter((p) => p.done).length} of {nextVisit.prep.length} preparations ready · escort: {nameOf(nextVisit.escortId)}
                      </p>
                    </>
                  )}
                </Link>
              ) : (
                <EmptyState
                  compact
                  icon={<Stethoscope aria-hidden="true" />}
                  title="No upcoming visits"
                  action={
                    <ButtonLink to="/appointments/new" size="sm" variant="soft">
                      Add appointment
                    </ButtonLink>
                  }
                />
              )}
            </Card>

            <Card>
              <CardHeader title="Today’s coverage" description="Who is doing what, and where the gaps are." />
              {!data.data ? <Skeleton className="h-36" /> : <CoverageTimeline tasks={today} absences={todayAbsences} conflictIds={conflictIds} />}
            </Card>

            <Card>
              <CardHeader
                title="Recent activity"
                action={
                  <Link to="/activity" className="text-[13px] font-semibold text-primary-700 hover:underline">
                    View all
                  </Link>
                }
              />
              {!data.data ? (
                <ListSkeleton rows={3} />
              ) : audit.length ? (
                <ul className="space-y-4">
                  {audit.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <Avatar name={nameOf(e.actorId)} seed={e.actorId} size="sm" />
                      <div className="min-w-0 text-sm">
                        <p className="text-ink">
                          <span className="font-semibold">{nameOf(e.actorId).split(' ')[0]}</span> {e.action.toLowerCase()}: {e.subject}
                        </p>
                        <p className="text-xs text-ink-subtle">{timeAgo(e.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">Updates from your circle will appear here.</p>
              )}
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
