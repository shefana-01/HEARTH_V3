import { CalendarDays, CircleCheck, Heart, History, ListChecks, MapPin } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { auditService } from '@/services/audit/auditService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTime, timeAgo } from '@/lib/dates';
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { useRequest } from './shared';

export default function SuccessPage() {
  useDocumentTitle('Reassignment confirmed');
  const req = useRequest();
  const { memberById, family } = useFamily();
  const audit = useAsync(() => auditService.list(), []);

  if (req.status === 'loading' && !req.data) return <PageSkeleton />;
  if (req.status === 'error' || !req.data) return <ErrorState headingLevel="h1" title="We couldn’t open this request" message={req.error?.message} onRetry={req.reload} />;

  const { request, task } = req.data;
  if (request.status !== 'approved') {
    return <EmptyState icon={<ListChecks aria-hidden="true" />} title="This reassignment hasn’t been approved yet" action={<ButtonLink to={`/priority/requests/${request.id}`}>Review candidates</ButtonLink>} />;
  }

  const to = memberById(request.approvedMemberId);
  const from = memberById(request.fromMemberId);
  const trail = (audit.data ?? []).filter((e) => e.subject === task.title).slice(0, 4);
  const end = new Date(new Date(task.start).getTime() + task.durationMin * 60_000).toISOString();

  return (
    <div className="mx-auto max-w-4xl">
      <Card padding="lg" className="mb-6 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-100 text-mint-700">
          <CircleCheck aria-hidden="true" className="h-8 w-8" />
        </span>
        <Badge tone="mint" size="md" className="mb-3">
          Care continuity preserved
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl">Task reassigned successfully</h1>
        <p className="mx-auto mt-2 max-w-lg text-ink-muted">
          {to?.name} now has “{task.title}”. {family?.recipient.name}’s routine is covered.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Card tone="mint" className="flex gap-3">
            <Heart aria-hidden="true" className="h-6 w-6 shrink-0 text-mint-600" />
            <div>
              <p className="font-semibold text-mint-800">Everyone affected has been notified</p>
              <p className="text-sm text-mint-800/90">
                {from ? `${from.name} has been released from this task. ` : ''}
                {to?.name} has the task details and time.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Hand-off details" action={<Badge tone="primary">{request.resolvedAt ? `Synced ${timeAgo(request.resolvedAt)}` : 'Synced'}</Badge>} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-mint-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">New assignee</span>
                  <Badge tone="mint">Assigned</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={to?.name ?? ''} seed={to?.id} />
                  <div>
                    <p className="font-semibold text-ink">{to?.name}</p>
                    <p className="text-[13px] text-ink-subtle">{to?.relation}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-surface-muted p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">Previous</span>
                  <Badge tone="rose">Released</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={from?.name ?? 'Unassigned'} seed={from?.id} />
                  <div>
                    <p className="font-semibold text-ink">{from?.name ?? 'Unassigned'}</p>
                    <p className="text-[13px] text-ink-subtle">{from?.relation}</p>
                  </div>
                </div>
              </div>
            </div>
            <dl className="mt-4 divide-y divide-line text-sm">
              <div className="flex gap-3 py-3">
                <ListChecks aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <div>
                  <dt className="eyebrow">Task</dt>
                  <dd className="font-semibold text-ink">{task.title}</dd>
                </div>
              </div>
              <div className="flex gap-3 py-3">
                <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <div>
                  <dt className="eyebrow">When</dt>
                  <dd className="font-semibold text-ink">
                    {formatDayTime(task.start)} – {formatTime(end)}
                  </dd>
                </div>
              </div>
              {task.notes && (
                <div className="flex gap-3 py-3">
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                  <div>
                    <dt className="eyebrow">Instructions</dt>
                    <dd className="whitespace-pre-line text-ink-muted">{task.notes}</dd>
                  </div>
                </div>
              )}
            </dl>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink to={`/tasks/${task.id}`}>View updated task</ButtonLink>
            <ButtonLink to="/schedule" variant="accent">
              View family schedule
            </ButtonLink>
            <ButtonLink to="/dashboard" variant="ghost">
              Done — back to overview
            </ButtonLink>
          </div>
        </div>

        <aside>
          <Card>
            <CardHeader title="Activity trail" icon={<History aria-hidden="true" className="h-5 w-5" />} />
            {trail.length ? (
              <ol className="space-y-3">
                {trail.map((e) => (
                  <li key={e.id} className="flex gap-2 text-[13px]">
                    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                    <span>
                      <span className="font-semibold text-ink">{formatTime(e.at)}</span> · {e.action}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-subtle">No entries yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
