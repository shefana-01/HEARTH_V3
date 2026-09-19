import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export type SimulatorView = 'current' | 'proposed' | 'impact';

/**
 * Phone & tablet navigation between the three simulator views. On desktop the
 * current and proposed states sit side by side, so this is hidden from `lg` up.
 */
export function SimulatorTabs({ active, query, hasChange }: { active: SimulatorView; query: string; hasChange: boolean }) {
  const base = new URLSearchParams(query);
  base.delete('view');
  const withView = (v: string) => {
    const p = new URLSearchParams(base);
    p.set('view', v);
    return `/what-if?${p.toString()}`;
  };
  const tabs: { id: SimulatorView; label: string; to: string; disabled?: boolean }[] = [
    { id: 'current', label: 'Current', to: withView('current') },
    { id: 'proposed', label: 'Proposed', to: withView('proposed') },
    { id: 'impact', label: 'Impact', to: `/what-if/impact?${base.toString()}`, disabled: !hasChange },
  ];
  return (
    <nav aria-label="Simulator views" className="mb-4 lg:hidden">
      <ul className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-sunken p-1">
        {tabs.map((t) => (
          <li key={t.id}>
            {t.disabled ? (
              <span aria-disabled="true" title="Change the person or time first" className="block rounded-xl py-2 text-center text-sm font-semibold text-ink-subtle/60">
                {t.label}
              </span>
            ) : (
              <Link
                to={t.to}
                replace
                aria-current={active === t.id ? 'page' : undefined}
                className={cn(
                  'block rounded-xl py-2 text-center text-sm font-semibold transition-colors',
                  active === t.id ? 'bg-surface text-primary-800 shadow-card' : 'text-ink-muted hover:text-ink',
                )}
              >
                {t.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
