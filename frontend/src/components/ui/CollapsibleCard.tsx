import type { ReactNode } from 'react';
import { useMinWidth, type BREAKPOINTS } from '@/hooks/useMediaQuery';
import { Card, CardHeader } from './Card';
import { Disclosure } from './Disclosure';

/**
 * A card on wide screens; a collapsed accordion item below `expandFrom`, so long
 * secondary detail doesn't push the main content off a phone screen.
 */
export function CollapsibleCard({
  title,
  icon,
  meta,
  description,
  action,
  expandFrom = 'lg',
  tone,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  /** Short summary shown on the collapsed row (e.g. a score). */
  meta?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  expandFrom?: keyof typeof BREAKPOINTS;
  tone?: 'default' | 'mint' | 'primary';
  children: ReactNode;
}) {
  const wide = useMinWidth(expandFrom);
  if (wide) {
    return (
      <Card tone={tone}>
        <CardHeader title={title} icon={icon} description={description} action={action} />
        {children}
      </Card>
    );
  }
  return (
    <Disclosure title={title} icon={icon} meta={meta}>
      {description && <p className="mb-3 text-sm text-ink-muted">{description}</p>}
      {children}
    </Disclosure>
  );
}
