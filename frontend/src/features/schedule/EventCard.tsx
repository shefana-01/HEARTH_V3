import { Link } from 'react-router-dom';
import { useFamily } from '@/app/FamilyProvider';
import { formatTime, formatTimeRange } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { KIND_STYLES } from './eventStyles';
import type { ScheduleEvent } from '@/types/domain';

/** One block on the schedule. Blocks with a `href` open their record; “Busy” blocks never do. */
export function EventCard({ event, compact }: { event: ScheduleEvent; compact?: boolean }) {
  const { firstNameOf } = useFamily();
  const style = KIND_STYLES[event.kind];
  const subtitle = event.subtitle ?? (event.kind === 'busy' && event.memberId ? firstNameOf(event.memberId) : undefined);
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[0.625rem] font-bold uppercase tracking-wide opacity-80">
        {style.label}
        <span className="normal-case tracking-normal">{compact ? formatTime(event.start) : formatTimeRange(event.start, event.end)}</span>
      </span>
      <span className={cn('mt-1 block font-semibold leading-snug', event.kind === 'busy' ? 'text-ink-muted' : 'text-ink', compact ? 'text-xs' : 'text-sm')}>{event.title}</span>
      {subtitle && <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-muted">{subtitle}</span>}
    </>
  );
  const cls = cn('block rounded-xl border p-2.5 text-left transition-shadow', style.card, event.href && 'hover:shadow-card');
  return event.href ? (
    <Link to={event.href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
