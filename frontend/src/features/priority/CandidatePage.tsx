import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Send, ShieldCheck, Sparkles, CircleCheckBig } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatTime, isSameDay } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { SKILLS } from '@/constants/labels';
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/ui';
import { ScorePill, SuitabilityBreakdown } from '@/components/domain/Scores';
import { fitLabel, riskOf, useRequest } from './shared';

export default function CandidatePage() {
  const { memberId = '' } = useParams();
  const req = useRequest();
  const { memberById, nameOf, family } = useFamily();
  const member = memberById(memberId);
  useDocumentTitle(member ? `Candidate: ${member.name}` : 'Candidate');
  const theirTasks = useAsync(() => taskService.listTasks({ assigneeId: memberId }), [memberId]);

  if (req.status === 'loading' && !req.data) return <PageSkeleton />;
  if (req.status === 'error' || !req.data) return <ErrorState headingLevel="h1" title="We couldn’t open this request" message={req.error?.message} onRetry={req.reload} />;

  const { request, task, candidates } = req.data;
  const index = candidates.findIndex((c) => c.memberId === memberId);
  const c = candidates[index];
  if (!c || !member) {
    return <EmptyState icon={<Info aria-hidden="true" />} title="This person isn’t a candidate for the task" action={<ButtonLink to={`/priority/requests/${request.id}`}>Back to recommendations</ButtonLink>} />;
  }

  const risk = riskOf(c);
  const sameDay = (theirTasks.data ?? []).filter((t) => t.status === 'scheduled' && isSameDay(t.start, task.start));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Priority center', to: '/priority' }, { label: 'Recommendations', to: `/priority/requests/${request.id}` }, { label: member.name }]}
        eyebrow="Hand-off intelligence"
        title="Candidate profile"
        description={`How well ${member.name} fits “${task.title}” for ${family?.recipient.name}.`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={member.name} seed={member.id} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl">{member.name}</h2>
                  <Badge tone={index === 0 ? 'mint' : 'primary'} size="md">
                    {fitLabel(c, index)}
                  </Badge>
                </div>
                <p className="text-sm text-ink-muted">{[member.relation, member.focus].filter(Boolean).join(' · ')}</p>
                {member.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {member.skills.map((s) => (
                      <Badge key={s}>{SKILLS[s]}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="eyebrow">Suitability</p>
                <p className="font-display text-4xl text-primary-700">{c.score}</p>
                <p className="text-xs text-ink-subtle">out of 100</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Why Hearth suggests ${member.name.split(' ')[0]}`} icon={<Sparkles aria-hidden="true" className="h-5 w-5" />} action={<Badge tone="primary">{c.reasons.length} match factors</Badge>} />
            <ul className="space-y-2.5">
              {c.reasons.map((r) => (
                <li key={r} className="flex items-start gap-3 rounded-xl bg-mint-50 p-3 text-sm text-ink">
                  <CircleCheckBig aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                  {r}
                </li>
              ))}
              {c.cautions.map((r) => (
                <li key={r} className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-ink">
                  <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {r}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Schedule & workload impact" description={`${member.name.split(' ')[0]}’s day, with this task added.`} />
            <ul className="space-y-2">
              {[...sameDay.map((t) => ({ id: t.id, title: t.title, start: t.start, target: false })), { id: 'target', title: task.title, start: task.start, target: true }]
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((row) => (
                  <li key={row.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm', row.target ? 'border border-dashed border-primary-300 bg-primary-50' : 'bg-surface-muted')}>
                    <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-ink-subtle">{formatTime(row.start)}</span>
                    <span className={cn('font-semibold', row.target ? 'text-primary-800' : 'text-ink')}>{row.title}</span>
                    {row.target && <Badge tone="primary">This task</Badge>}
                  </li>
                ))}
            </ul>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="eyebrow">Tasks that day</dt>
                <dd className="font-semibold text-ink">{c.tasksThatDay + 1} with this one</dd>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="eyebrow">Conflicts</dt>
                <dd className={cn('font-semibold', risk.tone === 'mint' ? 'text-mint-700' : 'text-red-600')}>{risk.note}</dd>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="eyebrow">Added time</dt>
                <dd className="font-semibold text-ink">+{task.durationMin} min</dd>
              </div>
            </dl>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Score breakdown" />
            <SuitabilityBreakdown candidate={c} />
          </Card>
          <Card>
            <CardHeader title="Candidate matrix" description="Everyone who could take this task." />
            <ul className="space-y-2">
              {candidates.map((x) => (
                <li key={x.memberId}>
                  <Link
                    to={`/priority/requests/${request.id}/candidates/${x.memberId}`}
                    aria-current={x.memberId === memberId ? 'true' : undefined}
                    className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', x.memberId === memberId ? 'border-primary-400 bg-primary-50' : 'border-line hover:border-primary-300')}
                  >
                    <Avatar name={nameOf(x.memberId)} seed={x.memberId} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{nameOf(x.memberId)}</span>
                    <ScorePill score={x.score} label="Suitability" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-subtle">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Approving notifies both people and records the change in the activity history.
            </p>
          </Card>
        </aside>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink to={`/tasks/${task.id}`} variant="ghost" leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}>
          Return to task
        </ButtonLink>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <ButtonLink to={`/priority/requests/${request.id}`} variant="accent">
            Choose another candidate
          </ButtonLink>
          <ButtonLink to={`/priority/requests/${request.id}/approve/${member.id}`} rightIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
            Propose reassignment to {member.name.split(' ')[0]}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
