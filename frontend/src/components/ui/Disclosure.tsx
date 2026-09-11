import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Expandable section (accordion item). */
export function Disclosure({
  title,
  icon,
  meta,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold text-ink hover:bg-surface-muted"
        >
          {icon && <span className="text-primary-600 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
          <span className="flex-1">{title}</span>
          {meta && <span className="text-xs font-medium text-ink-subtle">{meta}</span>}
          <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')} />
        </button>
      </h3>
      <div id={id} hidden={!open} className="border-t border-line px-4 py-4 text-sm text-ink-muted">
        {children}
      </div>
    </div>
  );
}
