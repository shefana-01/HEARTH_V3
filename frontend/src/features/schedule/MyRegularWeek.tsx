import { CalendarPlus, Pencil } from 'lucide-react';
import { eventService } from '@/services/schedule/eventService';
import { useAsync } from '@/hooks/useAsync';
import { EVENT_KINDS } from '@/constants/labels';
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { isFinished, recurrenceLine } from './eventText';

/** The signed-in person's own classes, shifts and other events. */
export function MyRegularWeek() {
  const events = useAsync(() => eventService.list(), []);
  const upcoming = (events.data ?? []).filter((e) => !isFinished(e)).sort((a, b) => Number(b.repeat === 'weekly') - Number(a.repeat === 'weekly') || a.start.localeCompare(b.start));

  return (
    <Card as="section" aria-labelledby="regular-week-heading">
      <CardHeader
        title={<span id="regular-week-heading">My regular week</span>}
        description="Classes, work and other plans Hearth plans around."
        action={
          upcoming.length > 0 ? (
            <ButtonLink to="/schedule/events/new" variant="soft" size="sm" leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}>
              Add
            </ButtonLink>
          ) : undefined
        }
      />
      {events.status === 'error' ? (
        <ErrorState headingLevel="h3" message={events.error?.message} onRetry={events.reload} />
      ) : !events.data ? (
        <ListSkeleton rows={2} />
      ) : upcoming.length === 0 ? (
        <EmptyState
          compact
          headingLevel="h3"
          icon={<CalendarPlus aria-hidden="true" />}
          title="Nothing here yet"
          description="Add your classes or work hours so Hearth knows when you are busy."
          action={<ButtonLink to="/schedule/events/new">Add to my schedule</ButtonLink>}
        />
      ) : (
        <ul className="space-y-2.5">
          {upcoming.map((e) => {
            const { label, icon: Icon } = EVENT_KINDS[e.kind];
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-xl bg-surface-muted px-4 py-3">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
                    {e.title}
                    {e.visibility === 'busy' && <Badge>Shown as busy</Badge>}
                  </p>
                  <p className="text-[0.8125rem] text-ink-muted">
                    {label} · {recurrenceLine(e)}
                  </p>
                </div>
                <ButtonLink to={`/schedule/events/${e.id}`} variant="secondary" size="sm" leftIcon={<Pencil aria-hidden="true" className="h-3.5 w-3.5" />} aria-label={`Edit ${e.title}`}>
                  Edit
                </ButtonLink>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
