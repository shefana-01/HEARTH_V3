import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BellRing, CalendarCheck2, CircleAlert, CircleCheck, ClipboardCheck, HelpCircle, Users, X } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { canApproveHandover, decisionService } from '@/services/decision/decisionService';
import { useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, formatTime } from '@/lib/dates';
import { plural } from '@/lib/format';
import { ActionBar, Avatar, Badge, Button, ButtonLink, Callout, Card, EmptyState, ErrorState, FormError, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import { riskOf, useRequest } from './shared';

export default function ApprovalPage() {
  useDocumentTitle('Confirm handover');
  const { memberId = '' } = useParams();
  const req = useRequest();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { memberById, firstNameOf, personName, me } = useFamily();
  const approve = useMutation(decisionService.approveRequest);

  if (req.status === 'loading' && !req.data) return <PageSkeleton />;
  if (req.status === 'error' || !req.data) return <ErrorState headingLevel="h1" title="We couldn’t open this handover" message={req.error?.message} onRetry={req.reload} />;

  const { request, task, candidates } = req.data;
  const candidate = candidates.find((c) => c.memberId === memberId);
  const to = memberById(memberId);
  const from = memberById(request.fromMemberId);
  const end = new Date(new Date(task.start).getTime() + task.durationMin * 60_000).toISOString();

  if (request.status !== 'open') {
    return <EmptyState icon={<CircleCheck aria-hidden="true" />} tone="mint" title="This handover is already settled" action={<ButtonLink to={`/tasks/${task.id}`}>Open task</ButtonLink>} />;
  }
  if (!candidate || !to) {
    return (
      <EmptyState icon={<CircleAlert aria-hidden="true" />} title="That person can’t take this task" action={<ButtonLink to={`/priority/requests/${request.id}`}>Choose someone else</ButtonLink>} />
    );
  }

  const risk = riskOf(candidate);
  const allowed = canApproveHandover(request, memberId, me ? { id: me.id, role: me.role } : undefined);
  const onApprove = async () => {
    const r = await approve.run(request.id, memberId);
    if (r) {
      toast({ title: 'Handed over', description: `${firstNameOf(memberId)} now has “${task.title}”.` });
      navigate(`/priority/requests/${request.id}/done`, { replace: true });
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Handovers', to: '/priority' }, { label: 'Who can take it?', to: `/priority/requests/${request.id}` }, { label: 'Confirm handover' }]}
        title="Confirm handover"
        description="Check the details. Everyone involved is told once you confirm."
        meta={
          <Badge tone="amber" dot size="md">
            Due {formatDayTime(task.start)}
          </Badge>
        }
      />

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Card tone="muted">
          <div className="mb-4 flex items-center justify-between">
            <Badge size="md">Now with</Badge>
            <Badge tone="amber">Will change</Badge>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Avatar name={from?.name ?? 'Nobody yet'} seed={from?.id} src={from?.photo} />
            <div>
              <p className="font-semibold text-ink">{from?.name ?? 'Nobody yet'}</p>
              <p className="text-[0.8125rem] text-ink-subtle">{from?.relation || from?.focus}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Task</dt>
              <dd className="font-semibold text-ink">{task.title}</dd>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Time</dt>
              <dd className="font-semibold text-ink">
                {formatTime(task.start)} – {formatTime(end)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[0.8125rem] text-amber-700">
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
              Taking it over
            </Badge>
            <ScorePill score={candidate.score} label="Match" />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <Avatar name={to.name} seed={to.id} src={to.photo} />
            <div>
              <p className="font-semibold text-ink">{to.name}</p>
              <p className="text-[0.8125rem] text-ink-subtle">{to.relation || to.focus}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Task</dt>
              <dd className="font-semibold text-ink">{task.title}</dd>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <dt className="eyebrow">Time</dt>
              <dd className="font-semibold text-ink">
                {formatTime(task.start)} – {formatTime(end)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface p-3 text-[0.8125rem] text-ink-muted">
            <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
            {candidate.reasons.join(' ') || 'Free at that time.'}
          </p>
        </Card>
      </div>

      <section aria-labelledby="consequences" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="consequences" className="font-display text-xl">
            What will change
          </h2>
          <Badge tone={risk.tone === 'mint' ? 'mint' : 'amber'}>Clash check: {risk.tone === 'mint' ? 'passed' : risk.note}</Badge>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: HelpCircle,
              title: 'Why',
              text: `${from ? `${firstNameOf(from.id)} can’t do it` : 'Nobody had it yet'}, and ${firstNameOf(to.id)} is ${candidate === candidates[0] ? 'the best match' : 'a good match'}.`,
            },
            {
              icon: CalendarCheck2,
              title: 'Their day',
              text: `${firstNameOf(to.id)} will have ${plural(candidate.tasksThatDay + 1, 'task')} that day. ${risk.note}.`,
            },
            {
              icon: Users,
              title: 'Who is affected',
              text: [from && `${from.name} (hands it over)`, `${to.name} (takes it)`, task.forId && `${personName(task.forId)} (it’s for them)`].filter(Boolean).join(' · '),
            },
            { icon: BellRing, title: 'Who is told', text: 'Both of them get a quiet update, and the family chat is told.' },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card padding="sm" className="h-full">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon aria-hidden="true" className="h-4 w-4 text-primary-600" /> {title}
                </p>
                <p className="text-[0.8125rem] text-ink-muted">{text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card tone="primary" className="mt-8">
        <FormError message={approve.error} />
        {!allowed && (
          <Callout tone="amber" className="mb-4" title="You can’t confirm this handover">
            Only the organiser, the person handing the task over, or the person taking it can confirm.
          </Callout>
        )}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck aria-hidden="true" className="h-6 w-6 shrink-0 text-primary-600" />
            <div>
              <p className="font-semibold text-ink">Confirmed by {me?.name ?? 'you'}</p>
              <p className="text-[0.8125rem] text-ink-muted">Your name goes in Activity as the person who confirmed it.</p>
            </div>
          </div>
          <ActionBar className="flex-row">
            <Button variant="ghost" className="h-11 lg:h-10" leftIcon={<X aria-hidden="true" className="h-4 w-4" />} onClick={() => navigate(`/priority/requests/${request.id}`)}>
              Go back
            </Button>
            <Button size="lg" className="flex-1 sm:flex-none" loading={approve.pending} disabled={!allowed} onClick={onApprove} leftIcon={<CircleCheck aria-hidden="true" className="h-5 w-5" />}>
              Confirm handover
            </Button>
          </ActionBar>
        </div>
      </Card>
    </>
  );
}
