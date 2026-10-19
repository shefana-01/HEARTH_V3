import { Link } from 'react-router-dom';
import { Check, Clock, Timer } from 'lucide-react';
import { LogoMark, Logo } from '@/components/layout/Logo';
import { AvatarGroup, Badge, ButtonLink } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** Compact entry screen: a hero circle with floating preview cards. */
export default function LandingPage() {
  useDocumentTitle('Welcome');
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-mint-50 via-mint-50 to-primary-50">
      <div aria-hidden="true" className="pointer-events-none absolute right-24 top-10 h-80 w-80 rounded-full bg-mint-200/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-rose-100/80 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link to="/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink sm:inline-block">
            About Hearth
          </Link>
          <ButtonLink to="/sign-in" size="sm" variant="secondary">
            Sign in
          </ButtonLink>
        </nav>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="relative flex aspect-square w-full max-w-[36rem] items-center justify-center">
          <div aria-hidden="true" className="absolute inset-0 rounded-full bg-[#F6EDE3] shadow-[0_20px_60px_-20px_rgba(120,100,80,0.25)]" />
          <div className="relative z-10 flex flex-col items-center px-8 text-center">
            <LogoMark className="mb-6 h-16 w-16 gap-1.5 rounded-2xl p-3.5 [&>span]:h-3.5 [&>span]:w-3.5" />
            <h1 className="font-sans text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">Your day, and your family’s, in one place.</h1>
            <p className="mt-5 max-w-sm text-ink-muted">Your schedule, shared tasks, family chat and papers together, with a clear answer to what to do first.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink to="/sign-up" className="rounded-full px-6">
                Sign up
              </ButtonLink>
              <ButtonLink to="/sign-in" variant="secondary" className="rounded-full border-transparent bg-surface/80 px-6">
                Sign in
              </ButtonLink>
            </div>
          </div>
        </div>

        {/* Decorative preview cards (desktop only) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute left-[6%] top-[6%] w-60 -rotate-3 rounded-2xl border border-rose-200/60 bg-rose-100 p-5 shadow-raised">
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary-300 shadow" />
            <p className="font-serif text-lg italic leading-snug text-rose-700">Say when you’re busy, and Hearth shows who in the family can step in.</p>
            <span className="absolute -bottom-8 -left-6 flex h-20 w-20 -rotate-12 items-center justify-center rounded-3xl border border-white bg-white/80 shadow-raised backdrop-blur">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-white">
                <Check className="h-6 w-6" strokeWidth={3} />
              </span>
            </span>
          </div>

          <div className="absolute right-[6%] top-[8%] w-64 rotate-6 rounded-3xl border border-white bg-surface p-5 shadow-raised">
            <span className="absolute -left-8 top-3 flex h-12 w-12 -rotate-6 items-center justify-center rounded-2xl bg-surface shadow-raised">
              <Timer className="h-6 w-6 text-ink" />
            </span>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-bold text-ink">Reminders</span>
              <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-muted">In 1 hour</span>
            </div>
            <div className="rounded-2xl bg-surface-muted p-3">
              <p className="text-[0.8125rem] font-bold text-ink">Dentist appointment</p>
              <p className="text-[0.6875rem] text-ink-subtle">Bring your insurance card</p>
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-[0.6875rem] font-semibold text-primary-700">
                <Clock className="h-3 w-3" /> 10:30 – 11:30
              </p>
            </div>
          </div>

          <div className="absolute bottom-[8%] left-[6%] w-72 -rotate-3 rounded-3xl border border-white bg-surface p-5 shadow-raised">
            <p className="mb-4 font-bold text-ink">My day</p>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink">
                <span className="h-3 w-3 rounded bg-rose-400" /> Finish lab report
              </p>
              <Badge tone="rose">Do first</Badge>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-primary-50 p-3">
              <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink">
                <span className="h-3 w-3 rounded bg-primary-400" /> Buy rice
              </p>
              <Badge tone="primary">Can wait</Badge>
            </div>
          </div>

          <div className="absolute bottom-[10%] right-[6%] w-64 rotate-3 rounded-3xl border border-white bg-surface p-5 shadow-raised">
            <p className="mb-4 font-bold text-ink">Your family</p>
            <AvatarGroup
              size="md"
              people={[
                { id: 'a', name: 'Sam Lee' },
                { id: 'b', name: 'Maya Patel' },
                { id: 'c', name: 'Ravi Kumar' },
                { id: 'd', name: 'Nora Ali' },
              ]}
            />
            <p className="mt-3 text-xs text-ink-subtle">Everyone sees the shared plan.</p>
          </div>
        </div>
      </main>
      <footer className="relative z-10 pb-5 text-center text-xs text-ink-subtle">© {new Date().getFullYear()} Hearth</footer>
    </div>
  );
}
