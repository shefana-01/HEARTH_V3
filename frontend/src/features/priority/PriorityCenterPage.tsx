import { Link } from 'react-router-dom';
import { ArrowRight, CircleCheckBig, ListOrdered } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, timeAgo } from '@/lib/dates';
import { Badge, ButtonLink, Card, Disclosure, EmptyState, ErrorState, ListSkeleton, PageHeader, SectionHeader } from '@/components/ui';
import { PriorityBreakdownView, ScorePill } from '@/components/domain/Scores';
import { CategoryIcon } from '@/components/domain/TaskRow';

export default function PriorityCenterPage() {
  useDocumentTitle('Priority center');
  const { nameOf, firstNameOf } = useFamily();
  const data = useAsync(() => Promise.all([decisionService.listAttention(), decisionService.listRequests()]), []);
  const [attention = [], requests = []] = data.data ?? [];
  const open = requests.filter((r) => r.status === 'open');
  const recent = requests.filter((r) => r.status !== 'open').slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Decision support"
        title="Priority center"
        description="Everything that needs a decision, ranked by the Task Priority Score — deadline, criticality, dependencies, how hard it is to cover and conflict severity."
      />
      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="ranked">
            <SectionHeader id="ranked" title="Needs a decision" count={attention.length} />
            {attention.length === 0 ? (
              <EmptyState tone="mint" icon={<CircleCheckBig aria-hidden="true" />} title="Nothing to decide right now" description="Every upcoming task has someone free to do it." />
            ) : (
              <ol className="space-y-3">
                {attention.map((item, i) => (
                  <li key={item.conflict.id}>
                    <Card padding="sm" className="sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <span className="hidden w-6 text-center font-display text-xl text-ink-subtle sm:block">{i + 1}</span>
                        <CategoryIcon category={item.task.category} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/tasks/${item.task.id}`} className="font-semibold text-ink hover:underline">
                              {item.task.title}
                            </Link>
                            <ScorePill score={item.priority.score} label="Priority score" />
                            {item.openRequestId && <Badge tone="primary">Reassignment open</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-ink-muted">{item.conflict.reason}</p>
                          <p className="mt-1 text-[13px] text-ink-subtle">
                            {formatDayTime(item.task.start)}
                            {item.topCandidate && ` · best match: ${firstNameOf(item.topCandidate.memberId)} (${item.topCandidate.score}/100)`}
                          </p>
                        </div>
                        <ButtonLink
                          to={item.openRequestId ? `/priority/requests/${item.openRequestId}` : `/tasks/${item.task.id}/resolve`}
                          size="sm"
                          rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
                        >
                          {item.openRequestId ? 'Choose caregiver' : 'Resolve'}
                        </ButtonLink>
                      </div>
                      <Disclosure title="Why this priority?" className="mt-4 border-none bg-surface-muted" meta={`${item.priority.score}/100`}>
                        <p className="mb-3">{item.priority.explanation}</p>
                        <PriorityBreakdownView priority={item.priority} />
                      </Disclosure>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {open.filter((r) => !attention.some((a) => a.openRequestId === r.id)).length > 0 && (
            <section aria-labelledby="open-requests">
              <SectionHeader id="open-requests" title="Open reassignment requests" />
              <ul className="space-y-2">
                {open
                  .filter((r) => !attention.some((a) => a.openRequestId === r.id))
                  .map((r) => (
                    <li key={r.id}>
                      <Link to={`/priority/requests/${r.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-primary-300">
                        <span>
                          <span className="block font-semibold text-ink">{r.taskTitle}</span>
                          <span className="block text-[13px] text-ink-subtle">
                            From {nameOf(r.fromMemberId)} · {formatDayTime(r.taskStart)}
                          </span>
                        </span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4 text-ink-subtle" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="recent">
            <SectionHeader id="recent" title="Recently resolved" />
            {recent.length ? (
              <ul className="space-y-2">
                {recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold text-ink">{r.taskTitle}</span>
                      <span className="text-ink-muted"> — {r.status === 'approved' ? `${firstNameOf(r.fromMemberId)} → ${firstNameOf(r.approvedMemberId)}` : 'request withdrawn'}</span>
                    </span>
                    <Badge tone={r.status === 'approved' ? 'mint' : 'neutral'}>{r.resolvedAt ? timeAgo(r.resolvedAt) : r.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-subtle">
                <ListOrdered aria-hidden="true" className="h-4 w-4" /> Resolved reassignments will be listed here.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
