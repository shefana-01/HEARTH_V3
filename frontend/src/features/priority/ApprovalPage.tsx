import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BellRing, CalendarCheck2, CircleAlert, CircleCheck, ClipboardCheck, HelpCircle, Users, X } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { decisionService } from '@/services/decision/decisionService';
import { useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTime } from '@/lib/dates';
import { ActionBar, Avatar, Badge, Button, ButtonLink, Callout, Card, EmptyState, ErrorState, FormError, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import { riskOf, useRequest } from './shared';

export default function ApprovalPage() {
  useDocumentTitle('Confirm reassignment');
  const { memberId = '' } = useParams();
  const req = useRequest();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { memberById, nameOf, firstNameOf, me, isLead, family } = useFamily();
  const approve = useMutation(decisionService.approveRequest);

  if (req.status === 'loading' && !req.data) return <PageSkeleton />;
  if (req.status === 'error' || !req.data) return <ErrorState headingLevel="h1" title="We couldn’t open this request" message={req.error?.message} onRetry={req.reload} />;

  const { request, task, candidates } = req.data;
  const candidate = candidates.find((c) => c.memberId === memberId);
  const to = memberById(memberId);
  const from = memberById(request.fromMemberId);
  const end = new Date(new Date(task.start).getTime() + task.durationMin * 60_000).toISOString();

  if (request.status !== 'open') {
    return <EmptyState icon={<CircleCheck aria-hidden="true" />} tone="mint" title="This request is already resolved" action={<ButtonLink to={`/tasks/${task.id}`}>Open task</ButtonLink>} />;
  }
  if (!candidate || !to) {
    return (
      <EmptyState
        icon={<CircleAlert aria-hidden="true" />}
        title="That person can’t be selected for this task"
        action={<ButtonLink to={`/priority/requests/${request.id}`}>Choose someone else</ButtonLink>}
      />
    );
  }

  const risk = riskOf(candidate);
  const onApprove = async () => {
    const r = await approve.run(request.id, memberId);
    if (r) {
      toast({ title: 'Reassignment approved', description: `${firstNameOf(memberId)} now has “${task.title}”.` });
      navigate(`/priority/requests/${request.id}/done`, { replace: true });
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Priority center', to: '/priority' }, { label: 'Recommendations', to: `/priority/requests/${request.id}` }, { label: 'Final approval' }]}
        title="Confirm care reassignment"
        description={`Review the hand-off so ${family?.recipient.name}’s routine stays uninterrupted.`}
        meta={
          <Badge tone="rose" dot size="md">
            Due {formatDayTime(task.start)}
          </Badge>
        }
      />

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Card tone="muted">
          <div className="mb-4 flex items-center justify-between">
            <Badge size="md">Current assignment</Badge>
            <Badge tone="amber">Pending change</Badge>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Avatar name={from?.name ?? 'Unassigned'} seed={from?.id} />
            <div>
              <p className="font-semibold text-ink">{from?.name ?? 'Unassigned'}</p>
              <p className="text-[13px] text-ink-subtle">{from?.relation || from?.focus}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Task</dt>
              <dd className="font-semibold text-ink">{task.title}</dd>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Window</dt>
              <dd className="font-semibold text-ink">
                {formatTime(task.start)} – {formatTime(end)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-700">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {request.reason}
          </p>
        </Card>

        <div className="flex items-center justify-center" aria-hidden="true">
          <span className="flex h-11 w-11 rotate-90 items-center justify-center rounded-full bg-primary-600 text-white shadow-raised lg:rotate-0">
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>

        <Card tone="mint" className="ring-1 ring-mint-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Badge tone="mint" size="md">
              Proposed assignment
            </Badge>
            <ScorePill score={candidate.score} label="Suitability" />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Avatar name={to.name} seed={to.id} />
            <div>
              <p className="font-semibold text-ink">{to.name}</p>
              <p className="text-[13px] text-ink-subtle">{to.relation || to.focus}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Task</dt>
              <dd className="font-semibold text-ink">{task.title}</dd>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Window</dt>
              <dd className="font-semibold text-ink">
                {formatTime(task.start)} – {formatTime(end)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface p-3 text-[13px] text-ink-muted">
            <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
            {candidate.reasons.join(' ') || 'Available for this time.'}
          </p>
        </Card>
      </div>

      <section aria-labelledby="consequences" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="consequences" className="font-display text-xl">
            What will change
          </h2>
          <Badge tone={risk.tone === 'mint' ? 'mint' : 'amber'}>Safety check: {risk.tone === 'mint' ? 'passed' : risk.note}</Badge>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: HelpCircle,
              title: 'Why the change',
              text: `${from ? `${firstNameOf(from.id)} can’t do it` : 'No one was assigned'}; ${firstNameOf(to.id)} is the ${candidate === candidates[0] ? 'best' : 'selected'} match.`,
            },
            {
              icon: CalendarCheck2,
              title: 'Schedule impact',
              text: `${firstNameOf(to.id)} will have ${candidate.tasksThatDay + 1} commitment${candidate.tasksThatDay ? 's' : ''} that day. ${risk.note}.`,
            },
            { icon: Users, title: 'People affected', text: [from?.name && `${from.name} (released)`, `${to.name} (new)`, `${family?.recipient.name} (recipient)`].filter(Boolean).join(' · ') },
            { icon: BellRing, title: 'Notifications', text: 'Both caregivers get a quiet update; the circle feed shows the change.' },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card padding="sm" className="h-full">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon aria-hidden="true" className="h-4 w-4 text-primary-600" /> {title}
                </p>
                <p className="text-[13px] text-ink-muted">{text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card tone="primary" className="mt-8">
        <FormError message={approve.error} />
        {!isLead && (
          <Callout tone="amber" className="mb-4" title="Only the lead caregiver can approve reassignments">
            Your request has been saved — the lead caregiver will see it in the Priority center.
          </Callout>
        )}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck aria-hidden="true" className="h-6 w-6 shrink-0 text-primary-600" />
            <div>
              <p className="font-semibold text-ink">Authorised by {me?.name ?? nameOf(me?.id)}</p>
              <p className="text-[13px] text-ink-muted">You’ll be recorded in the activity history as the approver.</p>
            </div>
          </div>
          <ActionBar className="flex-row">
            <Button variant="ghost" leftIcon={<X aria-hidden="true" className="h-4 w-4" />} onClick={() => navigate(`/priority/requests/${request.id}`)}>
              Go back
            </Button>
            <Button size="lg" className="flex-1 sm:flex-none" loading={approve.pending} disabled={!isLead} onClick={onApprove} leftIcon={<CircleCheck aria-hidden="true" className="h-5 w-5" />}>
              Approve reassignment
            </Button>
          </ActionBar>
        </div>
      </Card>
    </>
  );
}
