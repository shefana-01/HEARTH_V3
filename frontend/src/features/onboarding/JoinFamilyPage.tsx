import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CircleCheck, DoorOpen, Eye, KeyRound, Lock, MailCheck, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { familyService } from '@/services/family/familyService';
import { INVITE_CODE, INVITE_CODE_HINT } from '@/constants/invite';
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
    if (invite.data?.alreadyMember) return navigate('/dashboard');
    if (await join.run(code)) {
      await refreshSession();
      navigate('/dashboard');
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
            <h1 className="font-display text-3xl">Join a family circle</h1>
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
            <Callout tone="neutral" className="mt-6 text-[13px]">
              Preview limitation: until Hearth’s server is connected, invitations can only be found on the device where the family was created.
            </Callout>
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
                Private circle
              </Badge>
              <p className="font-display text-3xl">{invite.data.family.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                {invite.data.family.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    {invite.data.family.location}
                  </span>
                )}
                <span>Caring for {invite.data.family.recipient.name}</span>
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  { icon: Users, text: `${invite.data.memberCount} members` },
                  { icon: ShieldCheck, text: invite.data.family.careFocus },
                  { icon: CalendarDays, text: 'Shared weekly schedule' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-[13px] font-medium text-ink">
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-500" />
                    <span className="truncate">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <h2 className="mt-6 font-display text-lg">Your role & privacy</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-mint-50 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-mint-800">
                  <Eye aria-hidden="true" className="h-4 w-4" /> What you’ll see
                </p>
                <p className="text-[13px] text-ink-muted">The shared schedule, tasks assigned to you, appointments you help with and updates from the circle.</p>
              </div>
              <div className="rounded-2xl bg-primary-50 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary-800">
                  <Lock aria-hidden="true" className="h-4 w-4" /> What stays private
                </p>
                <p className="text-[13px] text-ink-muted">Restricted documents and medical details, unless the lead caregiver gives you access.</p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted px-4 py-3 text-[13px] text-ink-muted">
              <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
              You’ll join as a <span className="font-semibold text-ink">contributor</span> — you can see routines, share availability and volunteer for tasks.
            </p>

            <EmailConfirmNotice className="mt-4" />
            {join.error && (
              <div className="mt-4">
                <FormError message={join.error} />
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setDeclined(true)}>
                Decline politely
              </Button>
              <Button onClick={accept} loading={join.pending} leftIcon={<DoorOpen aria-hidden="true" className="h-4 w-4" />}>
                {invite.data.alreadyMember && session ? 'You’re already a member — open Hearth' : 'Accept & join'}
              </Button>
            </div>
          </Card>
        )}
        <p className="mt-6 text-center text-sm text-ink-subtle">
          Don’t have a code?{' '}
          <ButtonLink to="/sign-up" variant="ghost" size="sm">
            Start your own circle
          </ButtonLink>
        </p>
      </main>
    </div>
  );
}
