import { useShell } from '@/components/layout/ShellContext';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-ink-subtle">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
            {c.to ? (
              <Link to={c.to} className="rounded font-medium hover:text-primary-700 hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-ink-muted">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-semibold text-ink-muted hover:text-primary-700">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {children}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  back,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  back?: { to: string; label: string };
  meta?: ReactNode;
  className?: string;
}) {
  // On detail screens the mobile app bar already has a back button, so the trail is desktop-only there.
  const shell = useShell();
  const trailClass = shell?.hasMobileBack ? 'hidden lg:block' : undefined;
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {breadcrumbs && (
        <div className={trailClass}>
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}
      {back && (
        <div className={trailClass}>
          <BackLink to={back.to}>{back.label}</BackLink>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="font-display text-[1.875rem] leading-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 text-[15px] text-ink-muted">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeader({ title, count, aside, as: Heading = 'h2', id }: { title: ReactNode; count?: ReactNode; aside?: ReactNode; as?: 'h2' | 'h3'; id?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Heading id={id} className="font-display text-xl">
          {title}
        </Heading>
        {count !== undefined && <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">{count}</span>}
      </div>
      {aside && <div className="text-[13px] text-ink-subtle">{aside}</div>}
    </div>
  );
}
