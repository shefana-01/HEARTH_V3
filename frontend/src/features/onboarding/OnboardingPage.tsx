import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { familyService } from '@/services/family/familyService';
import { eventService } from '@/services/schedule/eventService';
import { LogoMark } from '@/components/layout/Logo';
import { Badge, Button, Card, FormError, ProgressBar, useToast } from '@/components/ui';
import { ROLES } from '@/constants/labels';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useAsync';
import { combineDateTime, toDateInputValue } from '@/lib/dates';
import { plural } from '@/lib/format';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { DRAFT_KEY, EMPTY_DRAFT, minutesBetween, STEPS, validateStep, type CommitmentRow, type Draft, type Errors } from './draft';
import { FamilyStep, InviteStep, PathStep, PeopleStep, ReviewStep, WelcomeStep, WeekStep } from './steps';

/** The label of the main button when the current step is optional and nothing was added. */
const EMPTY_LABELS: Partial<Record<(typeof STEPS)[number]['id'], string>> = { people: 'Nobody right now', week: 'Skip for now', invite: 'Skip for now' };

/** Add each regular commitment to the person’s own schedule. Resolves to how many could not be saved. */
async function saveCommitments(rows: CommitmentRow[]): Promise<number> {
  const today = toDateInputValue();
  const results = await Promise.allSettled(
    rows.map((c) =>
      eventService.create({
        title: c.title,
        kind: c.kind,
        start: combineDateTime(today, c.start),
        durationMin: minutesBetween(c.start, c.end),
        repeat: 'weekly',
        days: c.days,
        until: undefined,
        location: '',
        visibility: 'details',
      }),
    ),
  );
  return results.filter((r) => r.status === 'rejected').length;
}

export default function OnboardingPage() {
  useDocumentTitle('Set up your family space');
  const { session, refreshSession } = useAuth();
  const { refresh, family } = useFamily();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY_DRAFT, ...readJSON<Partial<Draft>>(DRAFT_KEY, {}) }));
  const [errors, setErrors] = useState<Errors>({});
  const create = useMutation(familyService.createFamily);

  useEffect(() => writeJSON(DRAFT_KEY, draft), [draft]);
  useEffect(() => {
    if (family) navigate('/today', { replace: true });
  }, [family, navigate]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const goTo = (step: number) => {
    setErrors({});
    setDraft((d) => ({ ...d, step }));
    window.scrollTo({ top: 0 });
  };
  const accountName = session?.account.name ?? '';
  const firstName = accountName.split(' ')[0] || 'there';
  const step = STEPS[draft.step].id;
  const isLast = draft.step === STEPS.length - 1;

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    const found = validateStep(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    if (step === 'path' && draft.path === 'join') {
      navigate(`/join/${draft.inviteCode.trim().toUpperCase()}`);
      return;
    }
    goTo(Math.min(draft.step + 1, STEPS.length - 1));
  };

  const finish = async () => {
    const result = await create.run({
      name: draft.familyName,
      location: draft.location,
      myRelation: draft.myRelation,
      dependants: draft.dependants.map(({ name, relation }) => ({ name, relation: relation.trim(), birthYear: undefined, notes: '' })),
      invites: draft.invites.map(({ key: _key, ...rest }) => rest),
      availability: { days: [true, true, true, true, true, true, true], windows: [] },
    });
    if (!result) return;
    const failed = await saveCommitments(draft.commitments);
    removeKey(DRAFT_KEY);
    await Promise.all([refresh(), refreshSession()]);
    toast({ title: `${result.name} is ready`, description: draft.invites.length ? `${plural(draft.invites.length, 'invitation')} sent.` : undefined });
    if (failed) toast({ tone: 'error', title: `${plural(failed, 'commitment')} could not be saved`, description: 'You can add them later from Schedule.' });
    navigate('/today', { replace: true });
  };

  const emptyLabel = EMPTY_LABELS[step];
  const nothingAdded = (step === 'people' && !draft.dependants.length) || (step === 'week' && !draft.commitments.length) || (step === 'invite' && !draft.invites.length);
  const nextLabel = step === 'welcome' ? 'Begin' : step === 'path' && draft.path === 'join' ? 'Find my family' : nothingAdded && emptyLabel ? emptyLabel : 'Continue';
  const progress = ((draft.step + 1) / STEPS.length) * 100;
  const lookedAfter = draft.dependants.filter((d) => d.name.trim()).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/70 via-canvas to-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="eyebrow">Getting started</p>
            <p className="text-sm text-ink-muted">Welcome, {firstName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs font-medium text-ink-subtle sm:flex">
            <span className="h-2 w-2 rounded-full bg-mint-500" aria-hidden="true" /> Progress saved on this device
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            Save & exit
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Card padding="sm" className="mb-6">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">{draft.step + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                Step {draft.step + 1} of {STEPS.length} — {STEPS[draft.step].title}
              </p>
              <ProgressBar value={progress} label="Setup progress" tone="rose" className="mt-2" />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card padding="lg" as="section" aria-live="polite">
            <form onSubmit={next} noValidate>
              {step === 'welcome' && <WelcomeStep firstName={firstName} />}
              {step === 'path' && <PathStep draft={draft} errors={errors} set={set} />}
              {step === 'family' && <FamilyStep draft={draft} errors={errors} set={set} accountName={accountName} />}
              {step === 'people' && <PeopleStep draft={draft} errors={errors} set={set} />}
              {step === 'week' && <WeekStep draft={draft} errors={errors} set={set} />}
              {step === 'invite' && <InviteStep draft={draft} errors={errors} set={set} />}
              {isLast && <ReviewStep draft={draft} error={<FormError message={create.error} />} />}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                {draft.step > 0 ? (
                  <Button variant="ghost" leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />} onClick={() => goTo(draft.step - 1)}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {isLast ? (
                  <Button onClick={finish} loading={create.pending} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                    Create family space & open My day
                  </Button>
                ) : (
                  <Button type="submit" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                    {nextLabel}
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <aside className="space-y-4">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Family preview</p>
                <Badge tone="mint" dot>
                  Live
                </Badge>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-mint-100 via-primary-50 to-rose-100 p-4">
                <p className="font-display text-xl">{draft.familyName.trim() || 'Your family'}</p>
                <p className="text-sm text-ink-muted">{draft.location.trim() || 'Your family space'}</p>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">{ROLES.lead.label}</dt>
                  <dd className="text-right font-medium text-ink">{accountName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Family</dt>
                  <dd className="text-right font-medium text-ink">{plural(draft.invites.length + 1, 'person', 'people')}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">You look after</dt>
                  <dd className="text-right font-medium text-ink">{lookedAfter ? plural(lookedAfter, 'person', 'people') : 'Nobody yet'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Your week</dt>
                  <dd className="text-right font-medium text-ink">{draft.commitments.length ? plural(draft.commitments.length, 'commitment') : 'Not added yet'}</dd>
                </div>
              </dl>
            </Card>
            <Card>
              <p className="mb-3 font-display text-lg">Setup journey</p>
              <ol className="space-y-1">
                {STEPS.map((s, i) => {
                  const done = i < draft.step;
                  const active = i === draft.step;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={i > draft.step}
                        onClick={() => goTo(i)}
                        aria-current={active ? 'step' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left disabled:cursor-default',
                          active ? 'bg-rose-50' : 'hover:bg-surface-muted disabled:hover:bg-transparent',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            done ? 'bg-mint-100 text-mint-700' : active ? 'bg-rose-500 text-white' : 'bg-surface-sunken text-ink-subtle',
                          )}
                        >
                          {done ? <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                        </span>
                        <span>
                          <span className={cn('block text-sm font-semibold', active ? 'text-rose-700' : 'text-ink')}>{s.title}</span>
                          <span className="block text-xs text-ink-subtle">{s.hint}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
