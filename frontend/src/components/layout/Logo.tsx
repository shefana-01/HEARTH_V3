import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/** Four soft dots — the Hearth mark from the landing screen, in the pastel palette. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid h-9 w-9 shrink-0 grid-cols-2 place-content-center gap-1 rounded-xl bg-surface p-2 shadow-card ring-1 ring-line', className)}>
      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-rose-200" />
      <span className="h-2.5 w-2.5 rounded-full bg-mint-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-primary-400" />
    </span>
  );
}

export function Logo({ to = '/', subtitle, className }: { to?: string; subtitle?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-xl', className)} aria-label="Hearth home">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-semibold tracking-tight text-ink">Hearth</span>
        {subtitle && <span className="mt-1 text-[11px] font-medium text-ink-subtle">{subtitle}</span>}
      </span>
    </Link>
  );
}
