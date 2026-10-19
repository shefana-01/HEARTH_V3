import { CalendarRange, TriangleAlert } from 'lucide-react';
import { formatTime, formatWeekdayShort } from '@/lib/dates';
import { plural } from '@/lib/format';
import { ButtonLink, Callout, Card } from '@/components/ui';
import type { ScheduleEvent } from '@/types/domain';

/** The week at a glance: how many tasks fit together, and the first clash to sort out. */
export function WeekSummary({ events }: { events: ScheduleEvent[] }) {
  const tasks = events.filter((e) => e.kind === 'task' || e.kind === 'conflict' || e.kind === 'completed');
  const clashes = events.filter((e) => e.kind === 'conflict');
  const fitting = tasks.length - clashes.length;
  const percent = tasks.length ? Math.round((fitting / tasks.length) * 100) : 100;
  const first = clashes[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${percent}% of tasks have no clash`}>
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-surface-sunken" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-mint-500" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(percent / 100) * 97.4} 97.4`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">{percent}%</span>
        </div>
        <div>
          <p className="eyebrow text-mint-700">Tasks this week</p>
          <p className="text-sm text-ink-muted">{tasks.length ? `${fitting} of ${plural(tasks.length, 'task')} fit with everything else` : 'No tasks planned yet'}</p>
        </div>
      </Card>
      {first ? (
        <Callout
          tone="red"
          icon={<TriangleAlert aria-hidden="true" />}
          title={`${plural(clashes.length, 'clash', 'clashes')} this week`}
          action={
            <ButtonLink to={first.href?.replace(/^\/tasks\/([^/]+)$/, '/tasks/$1/resolve') ?? '/priority'} size="sm">
              Sort it out
            </ButtonLink>
          }
        >
          {first.title} ({formatWeekdayShort(first.start)}, {formatTime(first.start)}) overlaps with something else.
        </Callout>
      ) : (
        <Callout tone="mint" icon={<CalendarRange aria-hidden="true" />} title="No clashes this week">
          Everyone’s plans fit together.
        </Callout>
      )}
    </div>
  );
}
