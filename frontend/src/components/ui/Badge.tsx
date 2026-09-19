import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/types/domain';

const soft: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  primary: 'bg-primary-100 text-primary-800',
  rose: 'bg-rose-100 text-rose-700',
  mint: 'bg-mint-100 text-mint-800',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-ink-subtle',
  primary: 'bg-primary-500',
  rose: 'bg-rose-500',
  mint: 'bg-mint-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', dot, size = 'sm', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-semibold', size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs', soft[tone], className)}
      {...rest}
    >
      {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dots[tone])} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function StatusDot({ tone = 'mint', className }: { tone?: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dots[tone], className)} />;
}
