import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CircleCheck, DoorOpen, Eye, KeyRound, Lock, MailCheck, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { familyService } from '@/services/family/familyService';
import { isDemoMode } from '@/services/config';
import { INVITE_CODE, INVITE_CODE_HINT } from '@/constants/invite';
import { ROLES } from '@/constants/labels';
import { plural } from '@/lib/format';
import { EmailConfirmNotice } from '@/components/domain/EmailConfirmNotice';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { LogoMark } from '@/components/layout/Logo';
import { Avatar, Badge, Button, ButtonLink, Callout, Card, FormError, FormField, Input, Skeleton } from '@/components/ui';

function CodeForm({ initial = '', error }: { initial?: string; error?: string }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initial);
  const [localError, setLocalError] = useState<string>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!INVITE_CODE.test(value)) {
      setLocalError(INVITE_CODE_HINT);
      return;
    }
    navigate(`/join/${value}`);
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <FormField label="Invitation code" error={localError ?? error} className="flex-1">
        {(p) => <Input {...p} leftIcon={<KeyRound />} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HEARTH-123" autoComplete="off" />}
      </FormField>
      <Button type="submit" className="sm:mt-7">
        Find invitation
      </Button>
    </form>
  );
}

export default function JoinFamilyPage() {
  useDocumentTitle('Join a family');
  const { code } = useParams();
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [declined, setDeclined] = useState(false);
  const invite = useAsync(() => (code ? familyService.lookupInvite(code) : Promise.resolve(null)), [code]);

  const join = useMutation(familyService.acceptInvite);

  const accept = async () => {
    if (!code) return;
    // Not signed in yet: create an account first, then come back here.
    if (!session) return navigate(`/sign-up?invite=${code}`);
    if (invite.data?.alreadyMember) return navigate('/today');
    if (await join.run(code)) {
      await refreshSession();
      navigate('/today');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-canvas to-mint-50/60">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Hearth home
        </Link>
        <LogoMark />
        <Badge tone="mint" dot size="md">
          Private family space
        </Badge>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        {!code ? (
          <Card padding="lg">
            <h1 className="font-display text-3xl">Join a family</h1>
            <p className="mb-6 mt-2 text-ink-muted">Enter the invitation code someone in your family shared with you.</p>
            <CodeForm />
          </Card>
        ) : invite.status === 'loading' ? (
          <Card padding="lg" className="space-y-4" aria-busy="true">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-28" />
            <Skeleton className="h-20" />
          </Card>
        ) : invite.status === 'error' || !invite.data ? (
          <Card padding="lg">
            <h1 className="font-display text-3xl">We couldn’t open that invitation</h1>
            <p className="mb-6 mt-2 text-ink-muted">Check the code with the person who invited you, or try again.</p>
            <CodeForm initial={code} error={invite.error?.message} />
            {isDemoMode && (
              <Callout tone="neutral" className="mt-6 text-[0.8125rem]">
                In the demo, invitations can only be found on the device where the family was created.
              </Callout>
            )}
          </Card>
        ) : declined ? (
          <Card padding="lg" className="text-center">
            <MailCheck aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-primary-600" />
            <h1 className="font-display text-2xl">Invitation declined</h1>
            <p className="mt-2 text-ink-muted">We’ll let {invite.data.inviterName} know you can’t join right now.</p>
            <Button variant="secondary" className="mt-6" onClick={() => setDeclined(false)}>
              Undo
            </Button>
          </Card>
        ) : (
          <Card padding="lg" className="shadow-raised">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={invite.data.inviterName} size="lg" />
                <div>
                  <p className="eyebrow">Family invitation</p>
                  <h1 className="font-display text-xl sm:text-2xl">{invite.data.inviterName} invited you to join</h1>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-rose-50 p-5">
              <Badge tone="rose" size="md" className="mb-3">
                Private family space
              </Badge>
              <p className="font-display text-3xl">{invite.data.family.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                {invite.data.family.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    {invite.data.family.location}
                  </span>
                )}
                <span>Invited by {invite.data.inviterName}</span>
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  { icon: Users, text: `${plural(invite.data.memberCount, 'person', 'people')} on Hearth` },
                  { icon: CalendarDays, text: 'Shared tasks and chat' },
                  { icon: ShieldCheck, text: 'Private stays private' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-[0.8125rem] font-medium text-ink">
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-500" />
                    <span className="truncate">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <h2 className="mt-6 font-display text-lg">What you’ll share and see</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-mint-50 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-mint-800">
                  <Eye aria-hidden="true" className="h-4 w-4" /> What you’ll see
                </p>
                <p className="text-[0.8125rem] text-ink-muted">The family’s shared tasks, the family chat, who is free, and appointments the family shares.</p>
              </div>
              <div className="rounded-2xl bg-primary-50 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary-800">
                  <Lock aria-hidden="true" className="h-4 w-4" /> What stays private
                </p>
                <p className="text-[0.8125rem] text-ink-muted">Anyone’s private tasks show only as “Busy”. Health notes and restricted papers stay hidden unless the organiser gives you access.</p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted px-4 py-3 text-[0.8125rem] text-ink-muted">
              <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
              You’ll join as a <span className="font-semibold text-ink">{ROLES.contributor.label.toLowerCase()}</span> or{' '}
              <span className="font-semibold text-ink">{ROLES.observer.label.toLowerCase()}</span>, as the organiser chose. Members keep their own schedule, take on tasks and can hand them over.
            </p>

            <EmailConfirmNotice className="mt-4" />
            {join.error && (
              <div className="mt-4">
                <FormError message={join.error} />
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeclined(true)}>
                Not now
              </Button>
              <Button onClick={accept} loading={join.pending} leftIcon={<DoorOpen aria-hidden="true" className="h-4 w-4" />}>
                {invite.data.alreadyMember && session ? 'You’re already in — open My day' : 'Accept & join'}
              </Button>
            </div>
          </Card>
        )}
        <p className="mt-6 text-center text-sm text-ink-subtle">
          Don’t have a code?{' '}
          <ButtonLink to="/sign-up" variant="ghost" size="sm">
            Start your own family space
          </ButtonLink>
        </p>
      </main>
    </div>
  );
}
