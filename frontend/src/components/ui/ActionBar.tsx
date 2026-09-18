import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useReportActionBarHeight, useShell } from '@/components/layout/ShellContext';

/**
 * A page's primary actions. On phones and tablets it is pinned to the bottom of the
 * screen (within thumb reach, above the tab bar if one is shown); from `lg` up it
 * renders inline where it is placed. It stays in the DOM where it is written, so
 * submit buttons inside a <form> keep working.
 */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useReportActionBarHeight(ref);
  const shell = useShell();
  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-x-0 z-20 flex flex-col gap-2 border-t border-line bg-surface/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(29,42,48,0.18)] backdrop-blur-md sm:flex-row sm:justify-end sm:px-6',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        shell?.hasTabBar ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))]' : 'bottom-0',
        'lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
