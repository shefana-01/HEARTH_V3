import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/types/domain';

type CardTone = 'default' | 'muted' | Exclude<Tone, 'neutral'>;

const tones: Record<CardTone, string> = {
  default: 'bg-surface border-line shadow-card',
  muted: 'bg-surface-muted border-line',
  primary: 'bg-primary-50 border-primary-100',
  rose: 'bg-rose-50 border-rose-100',
  mint: 'bg-mint-50 border-mint-100',
  amber: 'bg-amber-50 border-amber-100',
  red: 'bg-red-50 border-red-100',
};

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
  tone?: CardTone;
  padding?: keyof typeof paddings;
}

export function Card({ as: Tag = 'div', tone = 'default', padding = 'md', className, ...rest }: CardProps) {
  return <Tag className={cn('rounded-2xl border', tones[tone], paddings[padding], className)} {...rest} />;
}

/** Title row used at the top of a card. */
export function CardHeader({
  title,
  description,
  icon,
  action,
  as: Heading = 'h2',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-primary-600">{icon}</span>}
        <div className="min-w-0">
          <Heading className="font-display text-lg leading-snug">{title}</Heading>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
