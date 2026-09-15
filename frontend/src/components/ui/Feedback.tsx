import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import type { Tone } from '@/types/domain';

export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative block overflow-hidden rounded-lg bg-surface-sunken', className)}>
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </span>
  );
}

/** Full-page loading placeholder that mirrors a typical page layout. */
export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}…</span>
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 md:col-span-2" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

const toneIcon: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  primary: 'bg-primary-100 text-primary-700',
  rose: 'bg-rose-100 text-rose-600',
  mint: 'bg-mint-100 text-mint-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-600',
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'primary',
  compact = false,
  className,
  headingLevel: Heading = 'h2',
}: {
  icon: ReactNode;
  title: string;
  /** Use 'h1' when the empty state is the whole page (e.g. not found). */
  headingLevel?: 'h1' | 'h2' | 'h3';
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface/60 text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <span className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-2xl [&>svg]:h-6 [&>svg]:w-6', toneIcon[tone])}>{icon}</span>
      <Heading className="font-display text-lg">{title}</Heading>
      {description && <p className="mt-1.5 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  headingLevel: Heading = 'h2',
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Use 'h1' when the error replaces the whole page. */
  headingLevel?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-100 bg-red-50/60 px-6 py-12 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertTriangle aria-hidden="true" className="h-6 w-6" />
      </span>
      <Heading className="font-display text-lg">{title}</Heading>
      {message && <p className="mt-1.5 max-w-md text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-5" leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone = 'primary', label, className }: { value: number; max?: number; tone?: Tone; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const fill: Record<Tone, string> = {
    neutral: 'bg-ink-subtle',
    primary: 'bg-primary-500',
    rose: 'bg-rose-400',
    mint: 'bg-mint-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-sunken', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Informational banner. */
export function Callout({ tone = 'primary', icon, title, children, action, className }: { tone?: Tone; icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: 'border-line bg-surface-muted',
    primary: 'border-primary-100 bg-primary-50',
    rose: 'border-rose-100 bg-rose-50',
    mint: 'border-mint-100 bg-mint-50',
    amber: 'border-amber-100 bg-amber-50',
    red: 'border-red-100 bg-red-50',
  };
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center', tones[tone], className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon && <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface/80 [&>svg]:h-[18px] [&>svg]:w-[18px]', toneIcon[tone])}>{icon}</span>}
        <div className="min-w-0 text-sm text-ink-muted">
          {title && <p className="font-semibold text-ink">{title}</p>}
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
