import {
  ArrowRight,
  ArrowRightLeft,
  BellRing,
  CalendarClock,
  CalendarX2,
  CircleCheckBig,
  ClipboardList,
  Eye,
  FileLock2,
  FileText,
  History,
  Lock,
  MessagesSquare,
  Salad,
  Scale,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Type,
  UserRoundCheck,
  Users,
  BrainCircuit,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/layout/PublicLayout';
import { Badge, ButtonLink, Card } from '@/components/ui';
import { ROLES } from '@/constants/labels';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SampleButton } from '@/features/auth/SampleButton';
import { cn } from '@/lib/cn';

const PROBLEMS = [
  { icon: MessagesSquare, title: 'Group chats', text: '“Who’s picking up Mum’s medicine?” — buried under photos and replies.', tag: 'Easily missed', tone: 'rose' },
  { icon: CalendarClock, title: 'Separate calendars', text: 'Timetables and shifts that nobody else can see, so plans clash.', tag: 'Plans that clash', tone: 'amber' },
  { icon: StickyNote, title: 'Notes and lists', text: 'Shopping lists on the fridge and reminders on sticky notes.', tag: 'Only seen at home', tone: 'primary' },
  { icon: ClipboardList, title: 'Paper folders', text: 'Prescriptions, reports and insurance papers, never to hand when needed.', tag: 'Hard to find', tone: 'mint' },
  { icon: BrainCircuit, title: 'One person’s memory', text: 'Most of the planning lives in one tired person’s head.', tag: 'Quiet burnout', tone: 'rose' },
] as const;

const PILLARS = [
  { icon: CalendarClock, title: 'Your day, in order', text: 'Classes, work and to-dos in one view. Hearth tells you what to do first and what can wait.', tone: 'primary' },
  { icon: ArrowRightLeft, title: 'Can’t make it? Hand it over', text: 'Say you are busy and Hearth shows who in the family is free.', tone: 'mint' },
  { icon: MessagesSquare, title: 'Talk where the plan is', text: 'A family chat, status lines and comments on tasks, right next to the plan.', tone: 'rose' },
  { icon: Salad, title: 'Health notes that reach the shopping list', text: 'Note what the doctor said and get everyday food suggestions. General food guidance, not medical advice.', tone: 'mint' },
  { icon: FileText, title: 'Papers when you need them', text: 'Prescriptions, reports and insurance, kept private or shared with the people you choose.', tone: 'amber' },
  { icon: Type, title: 'For every age', text: 'A large text option and plain words, for teenagers, busy parents and grandparents.', tone: 'primary' },
] as const;

const DECISION_STEPS = [
  { icon: CalendarX2, title: 'Clash noticed', text: 'Hearth notices when a plan can’t go ahead — a class, a shift, an overlap or nobody to do it.' },
  { icon: Scale, title: 'Priorities ranked', text: 'Your day is ordered by deadline, how much it matters and how hard it is to cover.' },
  { icon: UserRoundCheck, title: 'Who is free', text: 'Hearth shows who in the family is free, from their schedules and what they usually handle.' },
  { icon: Eye, title: 'Preview first', text: 'The what-if view shows what a handover would fix, and what it might clash with.' },
  { icon: CircleCheckBig, title: 'You decide', text: 'Nothing changes by itself. A handover is approved first, and the family is told.' },
];

const FAMILY_ROLES = [
  { icon: Sparkles, title: ROLES.lead.label, text: 'Sets up the family space, invites people and chooses who sees what.' },
  { icon: Users, title: ROLES.contributor.label, text: 'Keeps their own schedule and tasks, shares what they choose, and can say “I can’t make it” without guilt.' },
  { icon: BellRing, title: ROLES.observer.label, text: 'Relatives who want to stay in the loop get updates, with no tasks to take on.' },
  { icon: ShieldCheck, title: 'People you look after', text: 'A child or grandparent who doesn’t use Hearth still has their appointments, health notes and papers kept for them.' },
];

const PRIVACY = [
  { icon: Lock, title: 'Private means private', text: 'Mark a task or appointment “Only me”. Your family just sees that you are busy.' },
  { icon: Eye, title: 'Health notes you control', text: 'Choose who can see your health notes. Hearth only uses them to suggest everyday foods.' },
  { icon: FileLock2, title: 'Papers, private or shared', text: 'Keep sensitive files for yourself, or share them only with the people who need them.' },
  { icon: History, title: 'Clear activity history', text: 'Every change records who did what and when, so nothing is a mystery.' },
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
      time: '9:00 AM',
      title: 'Chemistry class',
      who: 'On your schedule · your family sees “Busy”',
      badge: <Badge>Busy</Badge>,
    },
    { time: '2:00 PM', title: 'Finish lab report', who: 'Only me · due tonight', badge: <Badge tone="rose">Do first</Badge> },
    { time: '5:30 PM', title: 'Pick up groceries', who: 'Can’t make it? Rafid is free', badge: <Badge tone="mint">Hand over</Badge> },
  ];
  return (
    <Card padding="none" className="overflow-hidden shadow-raised" aria-label="Example of a day in Hearth">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted/60 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ink">My day, at a glance</p>
          <p className="text-xs text-ink-subtle">Example · 3 things today</p>
        </div>
        <Badge tone="mint" dot size="md">
          1 can be handed over
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
                Personal and family life organiser
              </Badge>
              <h1 className="font-display text-[2.5rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Your day, and your family’s, in one place.</h1>
              <p className="mt-5 max-w-xl text-lg text-ink-muted">
                Hearth brings your own schedule, your family’s shared tasks, a family chat, health notes that feed the shopping list, and your important papers into one place — and helps decide what
                to do first and who can step in.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to="/sign-up" size="lg" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                  Create your account
                </ButtonLink>
                <SampleButton size="lg" />
                <ButtonLink to="/sign-in" size="lg" variant="ghost">
                  Sign in
                </ButtonLink>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
                {['Use it alone, or with your family', 'Works on phone, tablet and desktop', 'Large text option and plain words'].map((t) => (
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
              <p className="eyebrow text-rose-600">The problem</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Life is spread across too many places.</h2>
              <p className="mt-3 text-ink-muted">Plans live in chats, calendars, notes and folders that don’t talk to each other, which quietly creates stress, gaps and mistakes.</p>
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
              Hearth brings your day and your family’s into one calm, shared rhythm.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-primary-700">How Hearth works</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Your own day first, then the family’s</h2>
              <p className="mt-3 text-ink-muted">Everyone keeps their own schedule and tasks, and shares the parts that matter, so the next step is always clear.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PILLARS.map(({ icon: Icon, title, text, tone }) => (
                <li key={title}>
                  <Card className="h-full">
                    <span className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-xl', toneBg[tone])}>
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

        {/* Handing over */}
        <section id="decisions" className="scroll-mt-20 bg-primary-50/70 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-primary-700">Handing over</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">When you can’t make it, Hearth helps the family adapt.</h2>
              <p className="mt-3 text-ink-muted">Not just a calendar — a helper that spots problems early and explains its suggestions.</p>
            </div>
            <Card padding="lg" className="mt-12">
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <CalendarX2 aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-sm text-ink">
                  <span className="font-semibold">Example:</span> you are due to pick up groceries at 5:30 PM, but your shift runs late.
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
                    <p className="mt-1 text-[0.8125rem] text-ink-muted">{text}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </section>

        {/* Roles */}
        <section id="family" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow text-mint-700">For every family</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">One plan, the right view for each person</h2>
              <p className="mt-3 text-ink-muted">Parents, grandparents, teenagers, partners or friends — Hearth adapts to whoever is in your family.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FAMILY_ROLES.map(({ icon: Icon, title, text }) => (
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
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Share what helps, keep the rest to yourself</h2>
              <p className="mt-3 text-ink-muted">Food suggestions are general guidance, not medical advice.</p>
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
                  Start today
                </Badge>
                <h2 className="font-display text-3xl sm:text-4xl">Bring order to your day, and warmth to your family’s.</h2>
                <p className="mt-3 text-ink-muted">Create your account, add your week, and invite your family when you are ready.</p>
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
                {['Create your account', 'Add your week', 'Add your first task', 'Invite your family'].map((s, i) => (
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
