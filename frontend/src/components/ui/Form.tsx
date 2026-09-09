import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Check, ChevronDown, Eye, EyeOff, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ───────────────────────── FormField ───────────────────────── */

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
}

export interface FormFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Optional text on the right of the label, e.g. "Optional". */
  aside?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + control + hint/error, with ids and ARIA wired up. */
export function FormField({ label, hint, error, required, aside, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {aside && <span className="text-xs text-ink-subtle">{aside}</span>}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] font-medium text-red-600">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-[13px] text-ink-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const control =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-subtle/80 transition-colors hover:border-primary-300 focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-100 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-100';

/* ───────────────────────── Input ───────────────────────── */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ leftIcon, rightSlot, className, ...rest }, ref) {
  return (
    <div className="relative flex items-center">
      {leftIcon && <span className="pointer-events-none absolute left-3.5 text-ink-subtle [&>svg]:h-[18px] [&>svg]:w-[18px]">{leftIcon}</span>}
      <input ref={ref} className={cn(control, 'h-11', leftIcon && 'pl-10', rightSlot && 'pr-11', className)} {...rest} />
      {rightSlot && <span className="absolute right-1.5">{rightSlot}</span>}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'rightSlot'>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-muted hover:text-ink"
        >
          {visible ? <EyeOff aria-hidden="true" className="h-[18px] w-[18px]" /> : <Eye aria-hidden="true" className="h-[18px] w-[18px]" />}
        </button>
      }
      {...props}
    />
  );
});

/* ───────────────────────── Textarea ───────────────────────── */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'min-h-[5.5rem] resize-y py-2.5 leading-relaxed', className)} {...rest} />;
});

/* ───────────────────────── Select ───────────────────────── */

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-11 cursor-pointer appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
    </div>
  );
});

/* ───────────────────────── Checkbox ───────────────────────── */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-line-strong bg-surface transition-colors checked:border-primary-600 checked:bg-primary-600 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
        <Check aria-hidden="true" strokeWidth={3} className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" />
      </span>
      <label htmlFor={inputId} className="cursor-pointer text-sm text-ink">
        <span className="font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-subtle">{description}</span>}
      </label>
    </div>
  );
});

/* ───────────────────────── Radio cards ───────────────────────── */

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
}

export function RadioCards<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  columns = 1,
  error,
}: {
  name: string;
  legend: ReactNode;
  options: RadioOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  error?: string;
}) {
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className={cn('grid gap-2.5', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'relative flex cursor-pointer items-start gap-3 rounded-xl border bg-surface p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500',
              value === o.value ? 'border-primary-500 bg-primary-50' : 'border-line hover:border-primary-300',
              o.disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary-600"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{o.label}</span>
                {o.aside}
              </span>
              {o.description && <span className="mt-0.5 block text-[13px] text-ink-muted">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ───────────────────────── Switch ───────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span id={`${id}-label`} className="text-sm font-semibold text-ink">
          {label}
        </span>
        {description && <p className="mt-0.5 text-[13px] text-ink-subtle">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-primary-600' : 'bg-line-strong',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

/* ───────────────────────── Segmented control ───────────────────────── */

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
}: {
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-surface-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg font-semibold transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Toggle chips ───────────────────────── */

export function ToggleChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors',
        pressed ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line bg-surface text-ink-muted hover:border-primary-300 hover:text-ink',
      )}
    >
      {pressed && <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

/* ───────────────────────── Quantity stepper ───────────────────────── */

export function QuantityStepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40">
        <Minus aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Form-level error banner. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
