import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';
import { buttonStyles, buttonVariants, type ButtonSize, type ButtonVariant } from './buttonStyles';

export type { ButtonSize, ButtonVariant };

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant, size, block, leftIcon, rightIcon, loading, disabled, className, children, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonStyles({ variant, size, block, className })} {...rest}>
      {loading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, CommonProps {}

/** A router link that looks like a button. */
export function ButtonLink({ variant, size, block, leftIcon, rightIcon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, block, className })} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required because the button only shows an icon. */
  label: string;
  variant?: 'ghost' | 'secondary' | 'soft';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, variant = 'ghost', size = 'md', className, children, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        buttonVariants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
