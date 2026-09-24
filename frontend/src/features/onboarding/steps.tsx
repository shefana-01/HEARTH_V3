import type { ReactNode } from 'react';
import { CalendarDays, Check, House, KeyRound, Lock, Plus, Trash2, Users } from 'lucide-react';
import { Badge, Button, Callout, FormField, Input, Select } from '@/components/ui';
import { EVENT_KINDS, RELATION_SUGGESTIONS, ROLES, WEEKDAY_LABELS } from '@/constants/labels';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { listNames } from '@/lib/format';
import type { EventKind, MemberRole } from '@/types/domain';
import { daysLabel, newKey, patchRow, WEEKDAYS_ONLY, type CommitmentRow, type Draft, type Errors } from './draft';

export interface StepProps {
  draft: Draft;
  errors: Errors;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}

const RELATIONS_LIST = 'onboarding-relations';

function RelationOptions() {
  return (
    <datalist id={RELATIONS_LIST}>
      {RELATION_SUGGESTIONS.map((r) => (
        <option key={r} value={r} />
      ))}
    </datalist>
  );
}

export function StepShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children: ReactNode }) {
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

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="danger-ghost" size="sm" className="mt-3" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={onClick} aria-label={label}>
      Remove
    </Button>
  );
}

/* ───────────────────────────── Welcome ───────────────────────────── */

export function WelcomeStep({ firstName }: { firstName: string }) {
  const points = [
    { icon: CalendarDays, title: 'Your day, in order', text: 'Classes, work and to-dos in one view, with what to do first.' },
    { icon: Users, title: 'Shared with family', text: 'Shared tasks, a family chat and a list of who is free.' },
    { icon: Lock, title: 'Private when you want', text: 'Your family only sees “Busy” for what you keep to yourself.' },
  ];
  return (
    <StepShell
      eyebrow="A good start"
      title={`Welcome to Hearth, ${firstName}.`}
      description="Hearth keeps your own schedule and tasks in one place, and shares what you choose with your family. You can use it by yourself and invite family later."
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {points.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-2xl bg-surface-muted p-4">
            <Icon aria-hidden="true" className="mb-2 h-5 w-5 text-mint-600" />
            <p className="font-semibold text-ink">{title}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">{text}</p>
          </li>
        ))}
      </ul>
    </StepShell>
  );
}

/* ───────────────────────────── Path ───────────────────────────── */

export function PathStep({ draft, errors, set }: StepProps) {
  const options = [
    {
      value: 'create' as const,
      icon: House,
      title: 'Start a family space',
      text: `Add your week, anyone you look after, and invite family. You’ll be the ${ROLES.lead.label.toLowerCase()}.`,
      badge: 'Recommended',
    },
    { value: 'join' as const, icon: KeyRound, title: 'Join a family', text: 'Use the invitation code someone in your family shared with you.', badge: 'Have a code' },
  ];
  return (
    <StepShell eyebrow="Choose a path" title="How would you like to start?" description="Start a new family space, or join one a relative has already created.">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Setup path">
        {options.map((o) => (
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
        <FormField label="Invitation code" hint="It starts with HEARTH-." error={errors.inviteCode} required className="mt-5 max-w-xs">
          {(p) => <Input {...p} value={draft.inviteCode} onChange={(e) => set('inviteCode', e.target.value.toUpperCase())} placeholder="HEARTH-123" autoComplete="off" />}
        </FormField>
      )}
    </StepShell>
  );
}

/* ───────────────────────────── Family space ───────────────────────────── */

export function FamilyStep({ draft, errors, set, accountName }: StepProps & { accountName: string }) {
  const lastName = accountName.trim().split(/\s+/).slice(1).pop();
  return (
    <StepShell eyebrow="Your family space" title="Name your family space" description="You can use Hearth by yourself and invite family later.">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Family name" hint="Shown to everyone you invite." error={errors.familyName} required className="sm:col-span-2">
          {(p) => <Input {...p} value={draft.familyName} onChange={(e) => set('familyName', e.target.value)} placeholder={lastName ? `${lastName} family` : 'The Rahman family'} />}
        </FormField>
        <FormField label="Where are you based?" aside="Optional">
          {(p) => <Input {...p} value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="City, country" autoComplete="address-level2" />}
        </FormField>
        <FormField label="How are you related to the family?" aside="Optional" hint="For example Mother, Daughter or Uncle.">
          {(p) => <Input {...p} list={RELATIONS_LIST} value={draft.myRelation} onChange={(e) => set('myRelation', e.target.value)} placeholder="Daughter" />}
        </FormField>
      </div>
      <RelationOptions />
    </StepShell>
  );
}

/* ───────────────────────────── People you look after ───────────────────────────── */

export function PeopleStep({ draft, errors, set }: StepProps) {
  return (
    <StepShell
      eyebrow="People you look after"
      title="Anyone you look after?"
      description="Add a child, a parent or a grandparent who won’t use Hearth themselves. You can then keep appointments, health notes and papers for them."
    >
      {draft.dependants.length === 0 && <p className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">Nobody right now is fine. You can add someone later from Family.</p>}
      <ul className="space-y-3">
        {draft.dependants.map((d, i) => (
          <li key={d.key} className="rounded-2xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Name" error={errors[`dependant-${i}`]} required>
                {(p) => <Input {...p} value={d.name} autoComplete="off" onChange={(e) => set('dependants', patchRow(draft.dependants, d.key, { name: e.target.value }))} />}
              </FormField>
              <FormField label="How are they related to you?" aside="Optional">
                {(p) => (
                  <Input {...p} list={RELATIONS_LIST} value={d.relation} placeholder="Mother" onChange={(e) => set('dependants', patchRow(draft.dependants, d.key, { relation: e.target.value }))} />
                )}
              </FormField>
            </div>
            <RemoveButton
              label={`Remove ${d.name.trim() || `person ${i + 1}`}`}
              onClick={() =>
                set(
                  'dependants',
                  draft.dependants.filter((x) => x.key !== d.key),
                )
              }
            />
          </li>
        ))}
      </ul>
      <Button
        variant="soft"
        className="mt-4"
        leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
        onClick={() => set('dependants', [...draft.dependants, { key: newKey(), name: '', relation: '' }])}
      >
        {draft.dependants.length === 0 ? 'Add someone' : 'Add another person'}
      </Button>
      <RelationOptions />
    </StepShell>
  );
}

/* ───────────────────────────── Your week ───────────────────────────── */

const COMMITMENT_PRESETS: { label: string; title: string; kind: EventKind }[] = [
  { label: 'Add classes', title: 'Classes', kind: 'class' },
  { label: 'Add work', title: 'Work', kind: 'work' },
  { label: 'Add something else', title: '', kind: 'personal' },
];

function DayChips({ days, label, onChange }: { days: boolean[]; label: string; onChange: (days: boolean[]) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {WEEKDAY_LABELS.map((d, i) => (
        <button
          key={d}
          type="button"
          aria-pressed={days[i]}
          onClick={() => onChange(days.map((on, j) => (j === i ? !on : on)))}
          className={cn(
            'h-11 w-14 rounded-xl border text-sm font-semibold transition-colors',
            days[i] ? 'border-primary-500 bg-primary-600 text-white' : 'border-line bg-surface text-ink-muted hover:border-primary-300',
          )}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

export function WeekStep({ draft, errors, set }: StepProps) {
  const update = (key: string, patch: Partial<CommitmentRow>) => set('commitments', patchRow(draft.commitments, key, patch));
  const add = (preset: (typeof COMMITMENT_PRESETS)[number]) =>
    set('commitments', [...draft.commitments, { key: newKey(), title: preset.title, kind: preset.kind, days: [...WEEKDAYS_ONLY], start: '09:00', end: '17:00' }]);

  return (
    <StepShell
      eyebrow="Your week"
      title="When are you busy?"
      description="Add your regular commitments, like classes or work. Hearth won’t plan tasks on top of these, and your family can see when you are free."
    >
      {draft.commitments.length === 0 && (
        <p className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">Nothing added yet. You can skip this and add your week later from Schedule.</p>
      )}
      <ul className="space-y-3">
        {draft.commitments.map((c, i) => (
          <li key={c.key} className="rounded-2xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="What is it?" error={errors[`title-${i}`]} required>
                {(p) => <Input {...p} value={c.title} placeholder="Classes" onChange={(e) => update(c.key, { title: e.target.value })} />}
              </FormField>
              <FormField label="Kind">
                {(p) => (
                  <Select {...p} value={c.kind} onChange={(e) => update(c.key, { kind: e.target.value as EventKind })}>
                    {Object.entries(EVENT_KINDS).map(([value, { label }]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-ink">Days</p>
              <DayChips days={c.days} label={`Days for ${c.title.trim() || `commitment ${i + 1}`}`} onChange={(days) => update(c.key, { days })} />
              {errors[`days-${i}`] && <p className="mt-2 text-[0.8125rem] font-medium text-red-600">{errors[`days-${i}`]}</p>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
              <FormField label="Starts" error={errors[`time-${i}`]} required className="col-span-2 sm:col-span-1">
                {(p) => <Input {...p} type="time" value={c.start} onChange={(e) => update(c.key, { start: e.target.value })} />}
              </FormField>
              <FormField label="Ends" required className="col-span-2 sm:col-span-1">
                {(p) => <Input {...p} type="time" value={c.end} onChange={(e) => update(c.key, { end: e.target.value })} />}
              </FormField>
            </div>
            <RemoveButton
              label={`Remove ${c.title.trim() || `commitment ${i + 1}`}`}
              onClick={() =>
                set(
                  'commitments',
                  draft.commitments.filter((x) => x.key !== c.key),
                )
              }
            />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {COMMITMENT_PRESETS.map((preset) => (
          <Button key={preset.label} variant="soft" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={() => add(preset)}>
            {preset.label}
          </Button>
        ))}
      </div>
    </StepShell>
  );
}

/* ───────────────────────────── Invite your family ───────────────────────────── */

export function InviteStep({ draft, errors, set }: StepProps) {
  const update = (key: string, patch: Partial<Draft['invites'][number]>) => set('invites', patchRow(draft.invites, key, patch));
  return (
    <StepShell
      eyebrow="Your family"
      title="Invite your family"
      description="Invite people who will use Hearth too. Each has their own schedule and tasks, and sees what you share. You can invite more people at any time."
    >
      {draft.invites.length === 0 && <p className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">No one added yet. You can also skip this and invite people later.</p>}
      <ul className="space-y-3">
        {draft.invites.map((inv, i) => (
          <li key={inv.key} className="rounded-2xl border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Name" error={errors[`name-${i}`]} required>
                {(p) => <Input {...p} value={inv.name} autoComplete="off" onChange={(e) => update(inv.key, { name: e.target.value })} />}
              </FormField>
              <FormField label="Email" error={errors[`email-${i}`]} required>
                {(p) => <Input {...p} type="email" value={inv.email} onChange={(e) => update(inv.key, { email: e.target.value })} />}
              </FormField>
              <FormField label="How are they related to you?" aside="Optional">
                {(p) => <Input {...p} list={RELATIONS_LIST} value={inv.relation} onChange={(e) => update(inv.key, { relation: e.target.value })} />}
              </FormField>
              <FormField label="Role">
                {(p) => (
                  <Select {...p} value={inv.role} onChange={(e) => update(inv.key, { role: e.target.value as MemberRole })}>
                    <option value="contributor">{ROLES.contributor.label} — takes on tasks</option>
                    <option value="observer">{ROLES.observer.label} — sees updates</option>
                  </Select>
                )}
              </FormField>
            </div>
            <RemoveButton
              label={`Remove ${inv.name.trim() || `person ${i + 1}`}`}
              onClick={() =>
                set(
                  'invites',
                  draft.invites.filter((x) => x.key !== inv.key),
                )
              }
            />
          </li>
        ))}
      </ul>
      {errors.invites && <p className="mt-3 text-[0.8125rem] font-medium text-red-600">{errors.invites}</p>}
      <Button
        variant="soft"
        className="mt-4"
        leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
        onClick={() => set('invites', [...draft.invites, { key: newKey(), name: '', email: '', relation: '', role: 'contributor' }])}
      >
        Add a person
      </Button>
      <RelationOptions />
    </StepShell>
  );
}

/* ───────────────────────────── Review ───────────────────────────── */

export function ReviewStep({ draft, error }: { draft: Draft; error: ReactNode }) {
  const names = (rows: { name: string }[]) => listNames(rows.map((r) => r.name.trim()));
  const rows: [string, string][] = [
    ['Family space', [draft.familyName.trim(), draft.location.trim()].filter(Boolean).join(' · ')],
    ['You are', [ROLES.lead.label, draft.myRelation.trim()].filter(Boolean).join(' · ')],
    ['People you look after', draft.dependants.length ? names(draft.dependants) : 'Nobody right now'],
    ['Invited', draft.invites.length ? names(draft.invites) : 'Nobody yet'],
  ];
  return (
    <StepShell eyebrow="All set" title="Ready to create your family space" description="Check the details below. You can change any of them later.">
      {error}
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-muted px-4 py-3">
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{v}</dd>
          </div>
        ))}
        <div className="rounded-xl bg-surface-muted px-4 py-3 sm:col-span-2">
          <dt className="eyebrow">Your week</dt>
          <dd className="mt-1 text-sm text-ink">
            {draft.commitments.length ? (
              <ul className="space-y-1">
                {draft.commitments.map((c) => (
                  <li key={c.key}>
                    <span className="font-semibold">{c.title.trim()}</span> · {daysLabel(c.days)}, {formatClock(c.start)} – {formatClock(c.end)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="font-semibold">Nothing added yet</span>
            )}
          </dd>
        </div>
      </dl>
      <Callout tone="mint" className="mt-4 text-[0.8125rem]">
        Your family sees these commitments by name. You can change any of them to show as “Busy” later from Schedule.
      </Callout>
    </StepShell>
  );
}
