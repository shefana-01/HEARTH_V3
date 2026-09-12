import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, CircleCheckBig, Clock, HandHeart, Info, Lock, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatDuration, timeAgo } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { PRIORITIES } from '@/constants/labels';
import { Avatar, Badge, ButtonLink, Callout, Card, EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import { fitLabel, riskOf, useRequest } from './shared';
import type { CandidateScore } from '@/types/domain';

function CandidateCard({ c, index, requestId }: { c: CandidateScore; index: number; requestId: string }) {
  const { memberById } = useFamily();
  const m = memberById(c.memberId);
  const risk = riskOf(c);
  const top = index === 0 && c.score >= 70;
  return (
    <li>
      <Card className={cn(top && 'border-primary-300 ring-1 ring-primary-200')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={m?.name ?? ''} seed={c.memberId} size="lg" />
            <div>
              <p className="font-display text-lg leading-tight">
                {m?.name} {m?.relation && <span className="font-sans text-sm text-ink-subtle">({m.relation})</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone={top ? 'mint' : c.score >= 50 ? 'primary' : 'neutral'}>{fitLabel(c, index)}</Badge>
                <ScorePill score={c.score} label="Suitability score" />
              </div>
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-surface-muted p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="eyebrow">Availability</dt>
            <dd className="font-semibold text-ink">{c.factors.availability === 1 ? 'Free' : c.factors.availability >= 0.5 ? 'Partly free' : 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="eyebrow">That day</dt>
            <dd className="font-semibold text-ink">
              {c.tasksThatDay} other task{c.tasksThatDay === 1 ? '' : 's'}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Conflict risk</dt>
            <dd className={cn('font-semibold', risk.tone === 'mint' ? 'text-mint-700' : risk.tone === 'amber' ? 'text-amber-700' : 'text-red-600')}>{risk.label}</dd>
          </div>
        </dl>
        {(c.reasons.length > 0 || c.cautions.length > 0) && (
          <ul className="mt-3 space-y-1 text-[13px]">
            {c.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-ink-muted">
                <CircleCheckBig aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" /> {r}
              </li>
            ))}
            {c.cautions.map((r) => (
              <li key={r} className="flex items-start gap-2 text-ink-muted">
                <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {r}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <ButtonLink to={`/priority/requests/${requestId}/candidates/${c.memberId}`} variant="ghost" size="sm">
            Review details
          </ButtonLink>
          <ButtonLink to={`/priority/requests/${requestId}/approve/${c.memberId}`} variant={top ? 'primary' : 'soft'} size="sm" leftIcon={<UserCheck aria-hidden="true" className="h-4 w-4" />}>
            Select {m?.name.split(' ')[0]}
          </ButtonLink>
        </div>
      </Card>
    </li>
  );
}

export default function RecommendationsPage() {
  useDocumentTitle('Recommended caregivers');
  const req = useRequest();
  const { nameOf, family } = useFamily();
  const [showAll, setShowAll] = useState(false);

  if (req.status === 'loading' && !req.data) return <PageSkeleton />;
  if (req.status === 'error' || !req.data) return <ErrorState headingLevel="h1" title="We couldn’t open this request" message={req.error?.message} onRetry={req.reload} />;

  const { request, task, candidates } = req.data;
  const eligible = candidates.filter((c) => c.score > 0);
  const top = eligible.slice(0, 2);
  const more = eligible.slice(2);

  const crumbs = [{ label: 'Priority center', to: '/priority' }, { label: 'Recommendations' }];

  if (request.status !== 'open') {
    return (
      <>
        <PageHeader breadcrumbs={crumbs} title="Reassignment request" />
        <EmptyState
          tone={request.status === 'approved' ? 'mint' : 'neutral'}
          icon={<CircleCheckBig aria-hidden="true" />}
          title={request.status === 'approved' ? `Already reassigned to ${nameOf(request.approvedMemberId)}` : 'This request was withdrawn'}
          description={request.resolvedAt ? `Resolved ${timeAgo(request.resolvedAt)}.` : undefined}
          action={<ButtonLink to={`/tasks/${task.id}`}>Open task</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader breadcrumbs={crumbs} title="Recommended caregivers" description="Ranked by the Candidate Suitability Score: availability, workload, skills and conflict cost." />

      <Callout tone="primary" icon={<HandHeart aria-hidden="true" />} className="mb-6" title={`${nameOf(request.fromMemberId)} can’t do “${task.title}”`}>
        {request.reason}
        {request.note && <span className="mt-1 block italic">“{request.note}”</span>}
      </Callout>

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Task to cover</p>
              <Badge tone={PRIORITIES[task.priority].tone}>{PRIORITIES[task.priority].label}</Badge>
            </div>
            <h2 className="font-display text-xl">{task.title}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex gap-3">
                <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <div>
                  <dt className="text-ink-subtle">When</dt>
                  <dd className="font-semibold text-ink">
                    {formatDayTime(task.start)} · {formatDuration(task.durationMin)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <div>
                  <dt className="text-ink-subtle">For</dt>
                  <dd className="font-semibold text-ink">{family?.recipient.name}</dd>
                </div>
              </div>
            </dl>
            {task.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-surface-muted p-3 text-[13px] text-ink-muted">{task.notes}</p>}
            <Link to={`/tasks/${task.id}`} className="mt-3 inline-block text-[13px] font-semibold text-primary-700 hover:underline">
              Open task
            </Link>
          </Card>
          <Card tone="primary" padding="sm" className="flex gap-2.5 text-[13px] text-primary-800">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Nothing is assigned automatically. People are only notified after you confirm.
          </Card>
        </aside>

        <section aria-labelledby="matches">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="matches" className="font-display text-xl">
              Best matches
            </h2>
            <Badge tone="primary" size="md">
              {top.length} top match{top.length === 1 ? '' : 'es'}
            </Badge>
          </div>
          {top.length === 0 ? (
            <EmptyState icon={<Users aria-hidden="true" />} title="Nobody is free for this" description="Invite more people to your circle, or change the task’s time." action={<ButtonLink to={`/tasks/${task.id}/edit`}>Change the time</ButtonLink>} />
          ) : (
            <ul className="space-y-4">
              {top.map((c, i) => (
                <CandidateCard key={c.memberId} c={c} index={i} requestId={request.id} />
              ))}
            </ul>
          )}
          {more.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((s) => !s)}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2">
                  <Users aria-hidden="true" className="h-4 w-4" /> {showAll ? 'Hide' : 'View'} other eligible members ({more.length})
                </span>
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', showAll && 'rotate-180')} />
              </button>
              {showAll && (
                <ul className="mt-4 space-y-4">
                  {more.map((c, i) => (
                    <CandidateCard key={c.memberId} c={c} index={i + 2} requestId={request.id} />
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-subtle">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" /> Family consent respected — the new caregiver can decline.
          </p>
        </section>
      </div>
    </>
  );
}
