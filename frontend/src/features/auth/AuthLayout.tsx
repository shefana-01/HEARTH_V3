import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-mint-100 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-[26rem] w-[26rem] rounded-full bg-rose-100 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary-50 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo />
        <span className="hidden items-center gap-1.5 rounded-full border border-mint-200 bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-800 sm:inline-flex">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          Private family space
        </span>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center">
        <div className="w-full max-w-[30rem]">
          {children}
          {footer && <div className="mt-4">{footer}</div>}
        </div>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 pb-6 text-xs text-ink-subtle sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} Hearth. Designed with quiet warmth.</p>
        <Link to="/" className="font-medium hover:text-ink">
          About Hearth
        </Link>
      </footer>
    </div>
  );
}
