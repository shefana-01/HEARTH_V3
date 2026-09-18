import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CalendarX2,
  CircleCheckBig,
  ClipboardList,
  Eye,
  FileLock2,
  History,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserRoundCheck,
  Users,
  BrainCircuit,
  Scale,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/layout/PublicLayout';
import { Badge, ButtonLink, Card } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SampleButton } from '@/features/auth/SampleButton';
import { cn } from '@/lib/cn';

const PROBLEMS = [
  { icon: MessagesSquare, title: 'Group chats', text: '“Did anyone give Dad his evening tablet?” — lost in a busy thread.', tag: 'Easily missed', tone: 'rose' },
  { icon: CalendarClock, title: 'Separate calendars', text: 'Clinic visits clash with work meetings nobody else can see.', tag: 'Scheduling clashes', tone: 'amber' },
  { icon: StickyNote, title: 'Notes on the fridge', text: 'Doses and phone numbers that only help whoever is in the kitchen.', tag: 'Only visible at home', tone: 'primary' },
  { icon: ClipboardList, title: 'Paper folders', text: 'Discharge letters full of jargon, with no clear next step.', tag: 'No clear next steps', tone: 'mint' },
  { icon: BrainCircuit, title: 'One person’s memory', text: 'Most of the planning lives in one tired person’s head.', tag: 'Quiet burnout', tone: 'rose' },
] as const;

const STEPS = [
  { title: 'Care need', text: 'A goal or instruction from the family or a professional.' },
  { title: 'Plan', text: 'Turned into plain-language tasks, appointments and meal goals.' },
  { title: 'Groceries', text: 'Matching food options go onto a shared shopping list.' },
  { title: 'Daily rhythm', text: 'Tasks land on the shared schedule at sensible times.' },
  { title: 'The right person', text: 'Each task goes to someone who is free and able to help.' },
  { title: 'Done', text: 'One tap to complete — everyone sees the update quietly.' },
];

const DECISION_STEPS = [
  { icon: CalendarX2, title: 'Conflict detected', text: 'Hearth notices when a plan can’t go ahead — an absence, an overlap or nobody assigned.' },
  { icon: Scale, title: 'Priorities ranked', text: 'A priority score weighs urgency, criticality, dependencies and how hard the task is to cover.' },
  { icon: UserRoundCheck, title: 'Best match suggested', text: 'Each family member gets a suitability score from their availability, workload and skills.' },
  { icon: Eye, title: 'Preview first', text: 'The what-if simulator shows what a change would fix — and what it might break.' },
  { icon: CircleCheckBig, title: 'You decide', text: 'Nothing is reassigned automatically. The lead approves, and the circle is notified.' },
];

const ROLES = [
  { icon: Sparkles, title: 'Lead caregiver', text: 'Sees the whole picture, resolves conflicts and approves changes — without holding every detail in their head.' },
  { icon: Users, title: 'Contributors', text: 'Siblings, partners, neighbours or paid carers see their own tasks, set availability and can step back without guilt.' },
  { icon: BellRing, title: 'Observers', text: 'Relatives who want to stay informed get calm updates, with no pressure to act.' },
  { icon: ShieldCheck, title: 'The person cared for', text: 'Their routines, preferences and dignity stay at the centre of every plan.' },
];

const PRIVACY = [
  { icon: Eye, title: 'Permission-aware sharing', text: 'Choose who can see medical details and documents, member by member.' },
  { icon: FileLock2, title: 'Restricted documents', text: 'Keep sensitive files visible only to the people who need them.' },
  { icon: History, title: 'Clear activity history', text: 'Every change records who did what and when, so nothing is a mystery.' },
  { icon: ShieldCheck, title: 'Your family’s data', text: 'Hearth is designed so family information is never sold or used for advertising.' },
];

const toneBg: Record<string, string> = {
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-700',
  primary: 'bg-primary-100 text-primary-700',
  mint: 'bg-mint-100 text-mint-700',
};

function HeroPreview() {
  const rows = [
    {
      time: '8:30 AM',
      title: 'Morning tablets & water',
      who: 'Done by Sam',
      badge: (
        <Badge tone="mint" dot>
          Done
        </Badge>
      ),
    },
    { time: '4:00 PM', title: 'Walk & blood pressure check', who: 'Claimed by Maya', badge: <Badge tone="primary">On track</Badge> },
    { time: '6:30 PM', title: 'Pharmacy pickup', who: 'Suggested: Ravi (free, 0.5 mi away)', badge: <Badge tone="rose">Needs you</Badge> },
  ];
  return (
    <Card padding="none" className="overflow-hidden shadow-raised" aria-label="Example of a family’s day in Hearth">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted/60 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ink">Today, at a glance</p>
          <p className="text-xs text-ink-subtle">Example family · 4 members connected</p>
        </div>
        <Badge tone="mint" dot size="md">
          1 decision waiting
        </Badge>
      </div>
      <ul className="space-y-2.5 p-4 sm:p-5">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 rounded-xl bg-surface-muted/70 px-3.5 py-3">
            <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-ink-subtle">{r.time}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
              <span className="block truncate text-xs text-ink-subtle">{r.who}</span>
            </span>
            {r.badge}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function PromoPage() {
  useDocumentTitle(undefined);
  return (
    <div className="min-h-screen overflow-x-hidden">
      <PublicHeader />
      <main>
        {/* Hero */}
        <section className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-rose-100 via-primary-100 to-mint-100 opacity-70 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <Badge tone="mint" size="md" className="mb-5">
                Calm family care coordination
              </Badge>
              <h1 className="font-display text-[2.5rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Caring for someone you love shouldn’t feel like running a hospital alone.</h1>
              <p className="mt-5 max-w-xl text-lg text-ink-muted">
                Hearth brings tasks, appointments, meals and everyone’s availability into one shared plan — and helps the family adapt when life changes.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to="/sign-up" size="lg" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Create your family circle
                </ButtonLink>
                <SampleButton size="lg" />
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
                {['For any family and any care situation', 'Works on phone, tablet and desktop', 'You stay in control of every change'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-mint-500" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* Problem */}
        <section id="problem" className="scroll-mt-20 bg-rose-50/60 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-rose-600">The caregiving dilemma</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Care doesn’t happen in one place.</h2>
              <p className="mt-3 text-ink-muted">Family caregiving is scattered across tools that don’t talk to each other — which quietly creates stress, gaps and mistakes.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PROBLEMS.map(({ icon: Icon, title, text, tag, tone }) => (
                <li key={title}>
                  <Card className="flex h-full flex-col">
                    <span className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-xl', toneBg[tone])}>
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-lg">{title}</h3>
                    <p className="mt-1.5 flex-1 text-sm text-ink-muted">{text}</p>
                    <p className="mt-4 border-t border-line pt-3 text-xs font-semibold text-rose-600">{tag}</p>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-10 max-w-xl rounded-2xl bg-gradient-to-r from-mint-100 via-primary-50 to-rose-100 px-6 py-5 text-center font-display text-xl">
              Hearth brings the scattered pieces together into one calm, shared rhythm.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-primary-700">How Hearth works</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">From a care need to a finished task</h2>
              <p className="mt-3 text-ink-muted">The CareGraph links goals, appointments, groceries, tasks and people — so every instruction becomes a clear, shared action.</p>
            </div>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <Card className="h-full">
                    <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{i + 1}</span>
                    <h3 className="font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Decision engine */}
        <section id="decisions" className="scroll-mt-20 bg-primary-50/70 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-primary-700">Smart coordination</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">When life changes, Hearth helps the family adapt.</h2>
              <p className="mt-3 text-ink-muted">Not just a calendar — a decision assistant that spots problems early and explains its suggestions.</p>
            </div>
            <Card padding="lg" className="mt-12">
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <CalendarX2 aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-sm text-ink">
                  <span className="font-semibold">Example:</span> the person driving to a 2:00 PM clinic visit is called into work at noon.
                </p>
              </div>
              <ol className="grid gap-4 md:grid-cols-5">
                {DECISION_STEPS.map(({ icon: Icon, title, text }, i) => (
                  <li key={title} className={cn('rounded-2xl border p-4', i === 4 ? 'border-mint-200 bg-mint-50' : 'border-line bg-surface-muted/60')}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Step {i + 1}</span>
                      <Icon aria-hidden="true" className="h-4 w-4 text-primary-600" />
                    </div>
                    <h3 className="font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-[13px] text-ink-muted">{text}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </section>

        {/* Roles */}
        <section id="circle" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-mint-700">For every family</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">One plan, the right view for each person</h2>
              <p className="mt-3 text-ink-muted">Parents, grandparents, children, partners, friends or paid carers — Hearth adapts to whoever is in your circle.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Card className="h-full">
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-700">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-lg">{title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{text}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="scroll-mt-20 bg-mint-50/70 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-mint-700">Privacy by design</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Coordination without giving up your family’s privacy</h2>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRIVACY.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Card className="h-full">
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-lg">{title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{text}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 rounded-3xl border border-line bg-gradient-to-br from-rose-50 via-surface to-primary-50 p-8 sm:p-12 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <Badge tone="rose" size="md" className="mb-4">
                  Start your family circle
                </Badge>
                <h2 className="font-display text-3xl sm:text-4xl">Bring predictability and warmth back to caring together.</h2>
                <p className="mt-3 text-ink-muted">Create a circle, invite the people who help, and add your first task in a few minutes.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink to="/sign-up" size="lg">
                    Get started
                  </ButtonLink>
                  <ButtonLink to="/join" size="lg" variant="secondary">
                    I have an invitation code
                  </ButtonLink>
                </div>
              </div>
              <ol className="space-y-3 lg:col-span-2">
                {['Create your family circle', 'Invite the people who help', 'Share availability', 'Add your first task'].map((s, i) => (
                  <li key={s} className="flex items-center gap-3 rounded-2xl bg-surface/90 px-4 py-3 shadow-card">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint-100 text-xs font-bold text-mint-800">{i + 1}</span>
                    <span className="text-sm font-semibold text-ink">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
