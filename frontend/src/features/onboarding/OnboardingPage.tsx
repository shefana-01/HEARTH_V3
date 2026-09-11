import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Heart, House, KeyRound, Leaf, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useFamily } from '@/app/FamilyProvider';
import { familyService, type InviteInput } from '@/services/family/familyService';
import { LogoMark } from '@/components/layout/Logo';
import { Badge, Button, Card, Checkbox, FormError, FormField, Input, ProgressBar, Select, Textarea, useToast } from '@/components/ui';
import { CARE_FOCUS_OPTIONS, RELATION_SUGGESTIONS, ROLES, WEEKDAY_LABELS } from '@/constants/labels';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMutation } from '@/hooks/useAsync';
import { readJSON, removeKey, writeJSON } from '@/lib/storage';
import { email as emailRule, required, validate } from '@/lib/validation';
import { cn } from '@/lib/cn';
import type { MemberRole, TimeWindow } from '@/types/domain';

const DRAFT_KEY = 'hearth.onboarding-draft';

const STEPS = [
  { title: 'Welcome', hint: 'What Hearth does' },
  { title: 'Choose path', hint: 'New circle or join one' },
  { title: 'Family profile', hint: 'Who you care for' },
  { title: 'Invite your circle', hint: 'People who help' },
  { title: 'Your availability', hint: 'When you can help' },
  { title: 'Ready', hint: 'Review & finish' },
];

const WINDOW_PRESETS: TimeWindow[] = [
  { id: 'morning', label: 'Mornings', start: '08:00', end: '12:00' },
  { id: 'afternoon', label: 'Afternoons', start: '12:00', end: '17:00' },
  { id: 'evening', label: 'Evenings', start: '17:00', end: '21:00' },
];

interface Draft {
  step: number;
  path: 'create' | 'join';
  inviteCode: string;
  familyName: string;
  careFocus: string;
  location: string;
  recipientName: string;
  recipientRelation: string;
  birthYear: string;
  careNotes: string;
  myRelation: string;
  invites: (InviteInput & { key: string })[];
  days: boolean[];
  windows: string[];
}

const EMPTY: Draft = {
  step: 0,
  path: 'create',
  inviteCode: '',
  familyName: '',
  careFocus: CARE_FOCUS_OPTIONS[0],
  location: '',
  recipientName: '',
  recipientRelation: '',
  birthYear: '',
  careNotes: '',
  myRelation: '',
  invites: [],
  days: [true, true, true, true, true, false, false],
  windows: ['evening'],
};

function StepShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children: ReactNode }) {
  return (
    <div>
      <Badge tone="mint" size="md" className="mb-4">
        {eyebrow}
      </Badge>
      <h1 className="font-display text-3xl sm:text-[2.1rem]">{title}</h1>
      {description && <p className="mt-2 text-ink-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export default function OnboardingPage() {
  useDocumentTitle('Set up your family');
  const { session, refreshSession } = useAuth();
  const { refresh, family } = useFamily();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY, ...readJSON<Partial<Draft>>(DRAFT_KEY, {}) }));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const create = useMutation(familyService.createFamily);

  useEffect(() => writeJSON(DRAFT_KEY, draft), [draft]);
  useEffect(() => {
    if (family) navigate('/dashboard', { replace: true });
  }, [family, navigate]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const goTo = (step: number) => {
    setErrors({});
    setDraft((d) => ({ ...d, step }));
    window.scrollTo({ top: 0 });
  };
  const firstName = session?.account.name.split(' ')[0] ?? 'there';
  const recipient = draft.recipientName.trim() || 'your loved one';

  const validateStep = (): boolean => {
    const e: Record<string, string | undefined> = {};
    if (draft.step === 1 && draft.path === 'join') {
      e.inviteCode = /^HEARTH-\d{3}$/i.test(draft.inviteCode.trim()) ? undefined : 'Enter the code you received, like HEARTH-123.';
    }
    if (draft.step === 2) {
      e.familyName = validate(draft.familyName, required('Family name'));
      e.recipientName = validate(draft.recipientName, required('Their name'));
      e.recipientRelation = validate(draft.recipientRelation, required('Relationship'));
      const year = Number(draft.birthYear);
      e.birthYear = draft.birthYear && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) ? 'Enter a four-digit year.' : undefined;
    }
    if (draft.step === 3) {
      draft.invites.forEach((inv, i) => {
        e[`name-${i}`] = validate(inv.name, required('Name'));
        e[`email-${i}`] = validate(inv.email, required('Email'), emailRule);
      });
      const emails = draft.invites.map((i) => i.email.trim().toLowerCase()).filter(Boolean);
      if (new Set(emails).size !== emails.length) e.invites = 'Each person needs a different email address.';
    }
    if (draft.step === 4 && !draft.days.some(Boolean)) e.days = 'Choose at least one day — you can change this later.';
    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    if (!validateStep()) return;
    if (draft.step === 1 && draft.path === 'join') {
      navigate(`/join/${draft.inviteCode.trim().toUpperCase()}`);
      return;
    }
    goTo(Math.min(draft.step + 1, STEPS.length - 1));
  };

  const finish = async () => {
    const result = await create.run({
      name: draft.familyName,
      location: draft.location,
      careFocus: draft.careFocus,
      myRelation: draft.myRelation,
      recipient: {
        name: draft.recipientName,
        relation: draft.recipientRelation.trim(),
        birthYear: draft.birthYear ? Number(draft.birthYear) : undefined,
        careNotes: draft.careNotes.trim(),
      },
      invites: draft.invites.map(({ key: _key, ...rest }) => rest),
      availability: { days: draft.days, windows: WINDOW_PRESETS.filter((w) => draft.windows.includes(w.id)) },
    });
    if (!result) return;
    removeKey(DRAFT_KEY);
    await Promise.all([refresh(), refreshSession()]);
    toast({ title: `${result.name} is ready`, description: draft.invites.length ? `${draft.invites.length} invitation(s) sent.` : undefined });
    navigate('/dashboard', { replace: true });
  };

  const progress = ((draft.step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/70 via-canvas to-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="eyebrow">Family setup</p>
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
              {draft.step === 0 && (
                <StepShell eyebrow="A gentle beginning" title={`Welcome to Hearth, ${firstName}.`} description="Caring for someone is an act of love — but you shouldn’t have to carry it alone. Hearth brings tasks, appointments and everyone’s availability into one shared plan.">
                  <ul className="grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: Leaf, title: 'Less clutter', text: 'Plain-language updates, no clinical jargon.' },
                      { icon: Users, title: 'Shared duties', text: 'Everyone can see and pick up tasks.' },
                      { icon: Heart, title: 'Dignity first', text: 'Routines built around the person you care for.' },
                    ].map(({ icon: Icon, title, text }) => (
                      <li key={title} className="rounded-2xl bg-surface-muted p-4">
                        <Icon aria-hidden="true" className="mb-2 h-5 w-5 text-mint-600" />
                        <p className="font-semibold text-ink">{title}</p>
                        <p className="mt-1 text-[13px] text-ink-muted">{text}</p>
                      </li>
                    ))}
                  </ul>
                </StepShell>
              )}

              {draft.step === 1 && (
                <StepShell eyebrow="Choose your path" title="How would you like to set up Hearth?" description="Start a new circle, or join one a relative has already created.">
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Setup path">
                    {[
                      { value: 'create' as const, icon: House, title: 'Create a new family circle', text: 'Set up a private space and invite the people who help. You’ll be the lead caregiver.', badge: 'Recommended' },
                      { value: 'join' as const, icon: KeyRound, title: 'Join an existing circle', text: 'Use the invitation code someone in your family shared with you.', badge: 'Have a code' },
                    ].map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={draft.path === o.value}
                        onClick={() => set('path', o.value)}
                        className={cn('rounded-2xl border p-5 text-left transition-colors', draft.path === o.value ? 'border-primary-500 bg-primary-50' : 'border-line hover:border-primary-300')}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-primary-600 shadow-card">
                            <o.icon aria-hidden="true" className="h-5 w-5" />
                          </span>
                          <Badge tone={o.value === 'create' ? 'mint' : 'rose'}>{o.badge}</Badge>
                        </div>
                        <p className="font-display text-lg">{o.title}</p>
                        <p className="mt-1 text-sm text-ink-muted">{o.text}</p>
                        {draft.path === o.value && (
                          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
                            <Check aria-hidden="true" className="h-3.5 w-3.5" /> Selected
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                  {draft.path === 'join' && (
                    <FormField label="Invitation code" hint="It looks like HEARTH-123." error={errors.inviteCode} required className="mt-5 max-w-xs">
                      {(p) => <Input {...p} value={draft.inviteCode} onChange={(e) => set('inviteCode', e.target.value.toUpperCase())} placeholder="HEARTH-123" autoComplete="off" />}
                    </FormField>
                  )}
                </StepShell>
              )}

              {draft.step === 2 && (
                <StepShell eyebrow="Family profile" title="Tell us about your family" description="Just the basics. No diagnoses or medical codes needed.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Family name" hint="Shown to everyone you invite, e.g. “The Rahman Family”." error={errors.familyName} required className="sm:col-span-2">
                      {(p) => <Input {...p} value={draft.familyName} onChange={(e) => set('familyName', e.target.value)} placeholder="The ___ Family" />}
                    </FormField>
                    <FormField label="Who are you caring for?" error={errors.recipientName} required>
                      {(p) => <Input {...p} value={draft.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder="Their name" autoComplete="off" />}
                    </FormField>
                    <FormField label="Their relationship to the family" hint="e.g. Mother, Grandfather, Son" error={errors.recipientRelation} required>
                      {(p) => (
                        <>
                          <Input {...p} list="relations" value={draft.recipientRelation} onChange={(e) => set('recipientRelation', e.target.value)} placeholder="Mother" />
                          <datalist id="relations">
                            {RELATION_SUGGESTIONS.map((r) => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        </>
                      )}
                    </FormField>
                    <FormField label="Year of birth" aside="Optional" error={errors.birthYear}>
                      {(p) => <Input {...p} inputMode="numeric" maxLength={4} value={draft.birthYear} onChange={(e) => set('birthYear', e.target.value.replace(/\D/g, ''))} placeholder="1950" />}
                    </FormField>
                    <FormField label="Main care focus">
                      {(p) => (
                        <Select {...p} value={draft.careFocus} onChange={(e) => set('careFocus', e.target.value)}>
                          {CARE_FOCUS_OPTIONS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </Select>
                      )}
                    </FormField>
                    <FormField label="Home location" aside="Optional" className="sm:col-span-2">
                      {(p) => <Input {...p} value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="City, country" autoComplete="address-level2" />}
                    </FormField>
                    <FormField label="Routines & preferences worth knowing" aside="Optional" hint="Visible to your circle." className="sm:col-span-2">
                      {(p) => <Textarea {...p} value={draft.careNotes} onChange={(e) => set('careNotes', e.target.value)} placeholder="e.g. Likes a slow morning, needs an arm on stairs, afternoon tea at 4." />}
                    </FormField>
                  </div>
                </StepShell>
              )}

              {draft.step === 3 && (
                <StepShell eyebrow="Your care circle" title="Who else helps?" description="Invite siblings, partners, friends or carers. You can add people and change permissions any time.">
                  <FormField label={`Your relationship to ${recipient}`} aside="Optional" className="mb-5 max-w-sm">
                    {(p) => <Input {...p} list="relations-me" value={draft.myRelation} onChange={(e) => set('myRelation', e.target.value)} placeholder="Daughter" />}
                  </FormField>
                  <datalist id="relations-me">
                    {RELATION_SUGGESTIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                  {draft.invites.length === 0 && <p className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">No one added yet. You can also skip this and invite people later.</p>}
                  <ul className="space-y-3">
                    {draft.invites.map((inv, i) => (
                      <li key={inv.key} className="rounded-2xl border border-line p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField label="Name" error={errors[`name-${i}`]} required>
                            {(p) => <Input {...p} value={inv.name} onChange={(e) => set('invites', draft.invites.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}
                          </FormField>
                          <FormField label="Email" error={errors[`email-${i}`]} required>
                            {(p) => <Input {...p} type="email" value={inv.email} onChange={(e) => set('invites', draft.invites.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />}
                          </FormField>
                          <FormField label="Relationship" aside="Optional">
                            {(p) => <Input {...p} list="relations-me" value={inv.relation} onChange={(e) => set('invites', draft.invites.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} />}
                          </FormField>
                          <FormField label="Role">
                            {(p) => (
                              <Select {...p} value={inv.role} onChange={(e) => set('invites', draft.invites.map((x, j) => (j === i ? { ...x, role: e.target.value as MemberRole } : x)))}>
                                <option value="contributor">{ROLES.contributor.label} — takes on tasks</option>
                                <option value="observer">{ROLES.observer.label} — updates only</option>
                              </Select>
                            )}
                          </FormField>
                        </div>
                        <Button variant="danger-ghost" size="sm" className="mt-3" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => set('invites', draft.invites.filter((_, j) => j !== i))}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {errors.invites && <p className="mt-3 text-[13px] font-medium text-red-600">{errors.invites}</p>}
                  <Button
                    variant="soft"
                    className="mt-4"
                    leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => set('invites', [...draft.invites, { key: crypto.randomUUID(), name: '', email: '', relation: '', role: 'contributor' }])}
                  >
                    Add a person
                  </Button>
                </StepShell>
              )}

              {draft.step === 4 && (
                <StepShell eyebrow="Routine harmony" title="When are you usually free to help?" description="Sharing your availability helps Hearth suggest fair, realistic plans and avoid burnout.">
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-ink">Days</legend>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_LABELS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={draft.days[i]}
                          onClick={() => set('days', draft.days.map((v, j) => (j === i ? !v : v)))}
                          className={cn('h-11 w-14 rounded-xl border text-sm font-semibold transition-colors', draft.days[i] ? 'border-primary-500 bg-primary-600 text-white' : 'border-line bg-surface text-ink-muted hover:border-primary-300')}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    {errors.days && <p className="mt-2 text-[13px] font-medium text-red-600">{errors.days}</p>}
                  </fieldset>
                  <fieldset className="mt-6">
                    <legend className="mb-2 text-sm font-semibold text-ink">Times of day</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {WINDOW_PRESETS.map((w) => (
                        <div key={w.id} className="rounded-2xl border border-line p-4">
                          <Checkbox
                            label={w.label}
                            description={`${w.start} – ${w.end}`}
                            checked={draft.windows.includes(w.id)}
                            onChange={(e) => set('windows', e.target.checked ? [...draft.windows, w.id] : draft.windows.filter((x) => x !== w.id))}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[13px] text-ink-subtle">You can fine-tune exact hours later in Schedule & availability.</p>
                  </fieldset>
                </StepShell>
              )}

              {draft.step === 5 && (
                <StepShell eyebrow="All set" title={`Your circle for ${recipient} is ready to create`} description="Check the details below. You can change any of them later.">
                  <FormError message={create.error} />
                  <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Family', draft.familyName],
                      ['Caring for', `${draft.recipientName}${draft.recipientRelation ? ` (${draft.recipientRelation})` : ''}`],
                      ['Care focus', draft.careFocus],
                      ['People invited', draft.invites.length ? draft.invites.map((i) => i.name).join(', ') : 'Nobody yet'],
                      ['Your days', WEEKDAY_LABELS.filter((_, i) => draft.days[i]).join(', ')],
                      ['Your times', WINDOW_PRESETS.filter((w) => draft.windows.includes(w.id)).map((w) => w.label).join(', ') || 'Not set'],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-surface-muted px-4 py-3">
                        <dt className="eyebrow">{k}</dt>
                        <dd className="mt-1 text-sm font-semibold text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </StepShell>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                {draft.step > 0 ? (
                  <Button variant="ghost" leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />} onClick={() => goTo(draft.step - 1)}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {(draft.step === 3 || draft.step === 4) && (
                    <Button variant="secondary" onClick={() => goTo(draft.step + 1)}>
                      Skip for now
                    </Button>
                  )}
                  {draft.step < 5 ? (
                    <Button type="submit" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                      {draft.step === 0 ? 'Begin' : draft.step === 1 && draft.path === 'join' ? 'Find my family' : 'Continue'}
                    </Button>
                  ) : (
                    <Button onClick={finish} loading={create.pending} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                      Create family & open dashboard
                    </Button>
                  )}
                </div>
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
                <p className="text-sm text-ink-muted">Caring for {recipient}</p>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Focus</dt>
                  <dd className="text-right font-medium text-ink">{draft.careFocus}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Lead</dt>
                  <dd className="text-right font-medium text-ink">{session?.account.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Circle</dt>
                  <dd className="text-right font-medium text-ink">{draft.invites.length + 1} {draft.invites.length ? 'people' : 'person'}</dd>
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
                    <li key={s.title}>
                      <button
                        type="button"
                        disabled={i > draft.step}
                        onClick={() => goTo(i)}
                        aria-current={active ? 'step' : undefined}
                        className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left disabled:cursor-default', active ? 'bg-rose-50' : 'hover:bg-surface-muted disabled:hover:bg-transparent')}
                      >
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-mint-100 text-mint-700' : active ? 'bg-rose-500 text-white' : 'bg-surface-sunken text-ink-subtle')}>
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
