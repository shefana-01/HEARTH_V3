import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarRange, CalendarX2, ChevronLeft, ChevronRight, Clock, User, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatShortDate, formatWeekdayShort, isSameDay, weekDays } from '@/lib/dates';
import { plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Avatar, Button, ButtonLink, Card, EmptyState, ErrorState, FabLink, IconButton, PageHeader, SegmentedControl, Skeleton, ToggleChip } from '@/components/ui';
import { DayTimeline } from './DayTimeline';
import { EventCard } from './EventCard';
import { KIND_STYLES, isTaskLike } from './eventStyles';
import { MyRegularWeek } from './MyRegularWeek';
import { WeekSummary } from './WeekSummary';

export default function SchedulePage() {
  useDocumentTitle('Schedule');
  const { members, me, family, firstNameOf } = useFamily();
  const [reference, setReference] = useState(() => new Date());
  const [view, setView] = useState<'week' | 'agenda'>('week');
  const [scope, setScope] = useState('me'); // 'me', 'everyone', or one member’s id
  const days = useMemo(() => weekDays(reference), [reference]);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const week = useAsync(() => scheduleService.getWeek(reference), [reference.toDateString()]);

  const all = week.data ?? [];
  const ownerId = scope === 'me' ? me?.id : scope;
  const events = scope === 'everyone' ? all : all.filter((e) => e.memberId === ownerId || e.alsoMemberId === ownerId);
  const isThisWeek = days.some((d) => isSameDay(d, new Date()));
  const activeMembers = members.filter((m) => m.status === 'active');

  const shiftWeek = (delta: number) => {
    const d = new Date(reference);
    d.setDate(d.getDate() + delta * 7);
    setReference(d);
    const sel = new Date(selectedDay);
    sel.setDate(sel.getDate() + delta * 7);
    setSelectedDay(sel);
  };
  const goToday = () => {
    setReference(new Date());
    setSelectedDay(new Date());
  };

  const hoursByMember = activeMembers.map((m) => ({
    member: m,
    hours: all.filter((e) => isTaskLike(e.kind) && (e.memberId === m.id || e.alsoMemberId === m.id)).reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000, 0),
  }));

  const range = `${formatShortDate(days[0].toISOString())} – ${formatShortDate(days[6].toISOString())}`;
  const emptyTitle = scope === 'me' ? 'Nothing on your schedule this week' : scope === 'everyone' ? 'Nothing planned this week' : `Nothing planned for ${firstNameOf(scope)}`;

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${family ? `${family.name} · ` : ''}week of ${range}`}
        actions={
          <>
            <ButtonLink to="/schedule/availability" variant="soft" leftIcon={<Clock aria-hidden="true" className="h-4 w-4" />}>
              When I’m free
            </ButtonLink>
            <ButtonLink to="/schedule/unavailable" variant="secondary" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
              I can’t make it
            </ButtonLink>
            <ButtonLink to="/schedule/events/new" className="hidden lg:inline-flex" leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}>
              Add to my schedule
            </ButtonLink>
          </>
        }
      />

      {week.status === 'error' ? (
        <ErrorState message={week.error?.message} onRetry={week.reload} />
      ) : (
        <div className="space-y-6">
          {!week.data ? (
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]" aria-hidden="true">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <WeekSummary events={all} />
          )}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [&>*]:shrink-0" role="group" aria-label="Whose schedule">
              <ToggleChip pressed={scope === 'me'} onClick={() => setScope('me')}>
                <User aria-hidden="true" className="h-3.5 w-3.5" /> Me
              </ToggleChip>
              <ToggleChip pressed={scope === 'everyone'} onClick={() => setScope('everyone')}>
                <Users aria-hidden="true" className="h-3.5 w-3.5" /> Everyone
              </ToggleChip>
              {activeMembers
                .filter((m) => m.id !== me?.id)
                .map((m) => (
                  <ToggleChip key={m.id} pressed={scope === m.id} onClick={() => setScope(m.id)}>
                    {firstNameOf(m.id)}
                  </ToggleChip>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden lg:block">
                <SegmentedControl
                  label="Calendar view"
                  size="sm"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'week', label: 'Week' },
                    { value: 'agenda', label: 'Agenda' },
                  ]}
                />
              </div>
              <div className="flex items-center gap-1">
                <IconButton label="Previous week" variant="secondary" onClick={() => shiftWeek(-1)}>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </IconButton>
                <Button variant="secondary" disabled={isThisWeek && isSameDay(selectedDay, new Date())} onClick={goToday}>
                  Today
                </Button>
                <IconButton label="Next week" variant="secondary" onClick={() => shiftWeek(1)}>
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>

          <ul className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle lg:flex" aria-label="Legend">
            {Object.values(KIND_STYLES).map((v) => (
              <li key={v.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('h-3 w-3 rounded border', v.card)} /> {v.label}
              </li>
            ))}
          </ul>

          {!week.data ? (
            <Skeleton className="h-96" />
          ) : events.length === 0 ? (
            <EmptyState
              icon={<CalendarRange aria-hidden="true" />}
              title={emptyTitle}
              description="Tasks, appointments, classes and time away will appear here."
              action={
                scope === 'me' ? (
                  <ButtonLink to="/schedule/events/new">Add to my schedule</ButtonLink>
                ) : (
                  <ButtonLink to="/tasks/new" variant="secondary">
                    Create a task
                  </ButtonLink>
                )
              }
            />
          ) : (
            <>
              <div className={cn('grid-cols-7 gap-2', view === 'week' ? 'hidden lg:grid' : 'hidden')}>
                {days.map((d) => {
                  const today = isSameDay(d, new Date());
                  const dayEvents = events.filter((e) => isSameDay(e.start, d));
                  return (
                    <section key={d.toISOString()} aria-label={d.toDateString()} className="min-w-0">
                      <header className={cn('mb-2 rounded-xl border px-2 py-2 text-center', today ? 'border-primary-300 bg-primary-50' : 'border-line bg-surface')}>
                        <p className={cn('text-[0.6875rem] font-semibold uppercase', today ? 'text-primary-700' : 'text-ink-subtle')}>{today ? 'Today' : formatWeekdayShort(d)}</p>
                        <p className="font-display text-xl">{d.getDate()}</p>
                        <p className="text-[0.6875rem] text-ink-subtle">{dayEvents.length ? plural(dayEvents.length, 'item') : 'Free'}</p>
                      </header>
                      <div className="space-y-2">
                        {dayEvents.map((e) => (
                          <EventCard key={e.id} event={e} compact />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
              <DayTimeline days={days} events={events} selected={selectedDay} onSelect={setSelectedDay} />
              <div className={cn('hidden space-y-6', view === 'agenda' && 'lg:block')}>
                {days.map((d) => {
                  const dayEvents = events.filter((e) => isSameDay(e.start, d));
                  if (!dayEvents.length) return null;
                  return (
                    <section key={d.toISOString()} aria-label={d.toDateString()}>
                      <h2 className="mb-2 font-display text-lg">
                        {isSameDay(d, new Date()) ? 'Today' : formatWeekdayShort(d)}, {formatShortDate(d.toISOString())}
                      </h2>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dayEvents.map((e) => (
                          <EventCard key={e.id} event={e} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          <MyRegularWeek />

          <section aria-labelledby="hours-heading">
            <h2 id="hours-heading" className="mb-3 font-display text-xl">
              This week, by person
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {hoursByMember.map(({ member, hours }) => (
                <li key={member.id}>
                  <Card padding="sm" className="flex items-center gap-3">
                    <Avatar name={member.name} seed={member.id} />
                    <div className="min-w-0">
                      <Link to={`/family/${member.id}`} className="truncate font-semibold text-ink hover:underline">
                        {member.name}
                      </Link>
                      <p className="text-[0.8125rem] text-ink-muted">{week.data ? `${hours.toFixed(1)} h of tasks` : 'Loading…'}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      <FabLink to="/schedule/events/new" icon={<CalendarPlus />}>
        Add to my schedule
      </FabLink>
    </>
  );
}
