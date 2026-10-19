import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useReportActionBarHeight, useShell } from '@/components/layout/ShellContext';

/**
 * Floating action button for a screen's main "create" action on phones and tablets.
 * Hidden from `lg` up, where the page header shows the same action as a normal button.
 */
export function FabLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useReportActionBarHeight(ref);
  const shell = useShell();
  return (
    <Link
      ref={ref}
      to={to}
      className={cn(
        'fixed right-4 z-20 inline-flex h-14 items-center gap-2 rounded-full bg-primary-600 pl-5 pr-6 text-[0.9375rem] font-semibold text-white shadow-raised transition-colors hover:bg-primary-700 sm:right-6 lg:hidden',
        shell?.hasTabBar ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
      )}
    >
      <span aria-hidden="true" className="[&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      {children}
    </Link>
  );
}
