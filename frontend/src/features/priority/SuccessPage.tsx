import { CalendarDays, CircleCheck, History, ListChecks, MapPin, MessagesSquare } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { auditService } from '@/services/audit/auditService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTime, timeAgo } from '@/lib/dates';
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { useRequest } from './shared';

export default function SuccessPage() {
  useDocumentTitle('Handed over');
  const req = useRequest();
  const { memberById } = useFamily();
  const audit = useAsync(() => auditService.list(), []);

  if (req.status === 'loading' && !req.data) return <PageSkeleton />;
  if (req.status === 'error' || !req.data) return <ErrorState headingLevel="h1" title="We couldn’t open this request" message={req.error?.message} onRetry={req.reload} />;

  const { request, task } = req.data;
  if (request.status !== 'approved') {
    return (
      <EmptyState
        icon={<ListChecks aria-hidden="true" />}
        title="This handover hasn’t been confirmed yet"
        action={<ButtonLink to={`/priority/requests/${request.id}`}>See who can take it</ButtonLink>}
      />
    );
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
          All sorted
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl">Handed over</h1>
        <p className="mx-auto mt-2 max-w-lg text-ink-muted">
          {to?.name} now has “{task.title}”. The family chat was told.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Card tone="mint" className="flex gap-3">
            <MessagesSquare aria-hidden="true" className="h-6 w-6 shrink-0 text-mint-600" />
            <div>
              <p className="font-semibold text-mint-800">The family chat was told</p>
              <p className="text-sm text-mint-800/90">
                {from ? `${from.name} no longer has this task. ` : ''}
                {to?.name} can see the details and the time.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Handover details" action={request.resolvedAt && <Badge tone="primary">{timeAgo(request.resolvedAt)}</Badge>} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-mint-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">Now with</span>
                  <Badge tone="mint">Has the task</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={to?.name ?? ''} seed={to?.id} src={to?.photo} />
                  <div>
                    <p className="font-semibold text-ink">{to?.name}</p>
                    <p className="text-[0.8125rem] text-ink-subtle">{to?.relation}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-surface-muted p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">Was with</span>
                  <Badge tone="rose">Handed over</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={from?.name ?? 'Nobody yet'} seed={from?.id} src={from?.photo} />
                  <div>
                    <p className="font-semibold text-ink">{from?.name ?? 'Nobody yet'}</p>
                    <p className="text-[0.8125rem] text-ink-subtle">{from?.relation}</p>
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
                    <dt className="eyebrow">Notes</dt>
                    <dd className="whitespace-pre-line text-ink-muted">{task.notes}</dd>
                  </div>
                </div>
              )}
            </dl>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink to={`/tasks/${task.id}`} className="h-11">
              View the task
            </ButtonLink>
            <ButtonLink to="/chat" variant="secondary" className="h-11">
              Open family chat
            </ButtonLink>
            <ButtonLink to="/today" variant="ghost" className="h-11">
              Back to my day
            </ButtonLink>
          </div>
        </div>

        <aside>
          <Card>
            <CardHeader title="In Activity" icon={<History aria-hidden="true" className="h-5 w-5" />} />
            {trail.length ? (
              <ol className="space-y-3">
                {trail.map((e) => (
                  <li key={e.id} className="flex gap-2 text-[0.8125rem]">
                    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                    <span>
                      <span className="font-semibold text-ink">{formatTime(e.at)}</span> · {e.action}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-subtle">Nothing yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
