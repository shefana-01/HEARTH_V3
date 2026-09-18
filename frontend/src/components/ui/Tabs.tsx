import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

/**
 * Accessible tab list (WAI-ARIA tabs pattern, manual activation with arrow keys).
 * Render the matching panel with <TabPanel>.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  idPrefix,
  className,
}: {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div role="tablist" aria-label={label} className={cn('scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1', className)}>
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
              selected ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted ring-1 ring-inset ring-line hover:text-ink hover:ring-primary-300',
            )}
          >
            {item.label}
            {item.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', selected ? 'bg-white/20' : 'bg-surface-sunken')}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, id, children, className }: { idPrefix: string; id: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} tabIndex={0} className={cn('focus-visible:ring-offset-4', className)}>
      {children}
    </div>
  );
}
