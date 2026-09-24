import { formatShortDate, formatTime, formatWeekdayShort, isSameDay } from '@/lib/dates';
import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EventCard } from './EventCard';
import { KIND_STYLES } from './eventStyles';
import type { ScheduleEvent } from '@/types/domain';

/** Phone & tablet view: pick a day, see it as a timeline. */
export function DayTimeline({ days, events, selected, onSelect }: { days: Date[]; events: ScheduleEvent[]; selected: Date; onSelect: (d: Date) => void }) {
  const dayEvents = events.filter((e) => isSameDay(e.start, selected)).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="lg:hidden">
      <div className="mb-5 grid grid-cols-7 gap-1.5" role="group" aria-label="Choose a day">
        {days.map((d) => {
          const active = isSameDay(d, selected);
          const today = isSameDay(d, new Date());
          const count = events.filter((e) => isSameDay(e.start, d)).length;
          const hasClash = events.some((e) => e.kind === 'conflict' && isSameDay(e.start, d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-pressed={active}
              aria-label={`${formatWeekdayShort(d)} ${d.getDate()}${today ? ', today' : ''}: ${count ? plural(count, 'item') : 'free'}${hasClash ? ', has a clash' : ''}`}
              onClick={() => onSelect(d)}
              className={cn(
                'flex min-h-[3.5rem] flex-col items-center rounded-2xl border py-2 transition-colors',
                active ? 'border-primary-600 bg-primary-600 text-white' : today ? 'border-primary-200 bg-primary-50 text-ink' : 'border-line bg-surface text-ink hover:border-primary-200',
              )}
            >
              <span className={cn('text-[0.6875rem] font-semibold uppercase', active ? 'text-primary-100' : 'text-ink-subtle')}>{formatWeekdayShort(d).slice(0, 2)}</span>
              <span className="font-display text-lg leading-tight">{d.getDate()}</span>
              <span aria-hidden="true" className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', !count ? 'bg-transparent' : hasClash ? 'bg-red-500' : active ? 'bg-white' : 'bg-primary-400')} />
            </button>
          );
        })}
      </div>

      <h2 className="mb-3 font-display text-lg">
        {isSameDay(selected, new Date()) ? 'Today' : formatWeekdayShort(selected)}, {formatShortDate(selected.toISOString())}
      </h2>
      {dayEvents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-8 text-center text-sm text-ink-muted">Nothing planned — a free day.</p>
      ) : (
        <ol className="relative space-y-3">
          <span aria-hidden="true" className="absolute bottom-3 left-[4.35rem] top-3 w-px bg-line-strong" />
          {dayEvents.map((e) => (
            <li key={e.id} className="relative grid grid-cols-[3.75rem_minmax(0,1fr)] gap-4">
              <span className="pt-2.5 text-right text-xs font-semibold text-ink-muted">{formatTime(e.start)}</span>
              <span aria-hidden="true" className={cn('absolute left-[4.1rem] top-3.5 h-2.5 w-2.5 rounded-full ring-4 ring-canvas', KIND_STYLES[e.kind].dot)} />
              <EventCard event={e} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
