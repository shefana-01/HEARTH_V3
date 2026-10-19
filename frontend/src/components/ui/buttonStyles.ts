import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'accent' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-muted active:bg-surface-sunken',
  soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200',
  accent: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  'danger-ghost': 'text-red-600 hover:bg-red-50',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.8125rem]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[0.9375rem]',
};

/** Class names for button-like elements (Button, ButtonLink, and plain links styled as buttons). */
export function buttonStyles({ variant = 'primary', size = 'md', block = false, className }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(base, buttonVariants[variant], sizes[size], block && 'w-full', className);
}
