import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarRange, CalendarX2, ChevronLeft, ChevronRight, Clock, TriangleAlert, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatShortDate, formatTime, formatWeekdayShort, isSameDay, weekDays } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Avatar, ButtonLink, Callout, Card, EmptyState, ErrorState, IconButton, PageHeader, SegmentedControl, Skeleton, ToggleChip, Button } from '@/components/ui';
import type { ScheduleEvent } from '@/types/domain';

const KIND_STYLES: Record<ScheduleEvent['kind'], { card: string; label: string }> = {
  task: { card: 'border-primary-200 bg-primary-50 text-primary-900', label: 'Care task' },
  completed: { card: 'border-mint-200 bg-mint-50 text-mint-800', label: 'Done' },
  conflict: { card: 'border-red-300 bg-red-50 text-red-700 ring-1 ring-red-200', label: 'Conflict' },
  appointment: { card: 'border-rose-200 bg-rose-50 text-rose-700', label: 'Appointment' },
  unavailable: { card: 'border-line bg-surface-sunken text-ink-muted', label: 'Unavailable' },
};

function EventCard({ event, compact }: { event: ScheduleEvent; compact?: boolean }) {
  const style = KIND_STYLES[event.kind];
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide opacity-80">
        {style.label}
        <span className="normal-case tracking-normal">{formatTime(event.start)}</span>
      </span>
      <span className={cn('mt-1 block font-semibold leading-snug text-ink', compact ? 'text-[12px]' : 'text-sm')}>{event.title}</span>
      {event.subtitle && <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{event.subtitle}</span>}
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

const DOT: Record<ScheduleEvent['kind'], string> = {
  task: 'bg-primary-500',
  completed: 'bg-mint-500',
  conflict: 'bg-red-500',
  appointment: 'bg-rose-500',
  unavailable: 'bg-ink-subtle',
};

/** Phone & tablet view: pick a day, see it as a timeline. */
function DayTimeline({ days, events, selected, onSelect }: { days: Date[]; events: ScheduleEvent[]; selected: Date; onSelect: (d: Date) => void }) {
  const dayEvents = events.filter((e) => isSameDay(e.start, selected)).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="lg:hidden">
      <div className="mb-5 grid grid-cols-7 gap-1.5" role="group" aria-label="Choose a day">
        {days.map((d) => {
          const active = isSameDay(d, selected);
          const today = isSameDay(d, new Date());
          const count = events.filter((e) => isSameDay(e.start, d)).length;
          const hasConflict = events.some((e) => e.kind === 'conflict' && isSameDay(e.start, d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-pressed={active}
              aria-label={`${formatWeekdayShort(d)} ${d.getDate()}${today ? ', today' : ''}: ${count ? `${count} item${count > 1 ? 's' : ''}` : 'free'}${hasConflict ? ', has a conflict' : ''}`}
              onClick={() => onSelect(d)}
              className={cn(
                'flex flex-col items-center rounded-2xl border py-2 transition-colors',
                active ? 'border-primary-600 bg-primary-600 text-white' : today ? 'border-primary-200 bg-primary-50 text-ink' : 'border-line bg-surface text-ink hover:border-primary-200',
              )}
            >
              <span className={cn('text-[11px] font-semibold uppercase', active ? 'text-primary-100' : 'text-ink-subtle')}>{formatWeekdayShort(d).slice(0, 2)}</span>
              <span className="font-display text-lg leading-tight">{d.getDate()}</span>
              <span aria-hidden="true" className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', !count ? 'bg-transparent' : hasConflict ? 'bg-red-500' : active ? 'bg-white' : 'bg-primary-400')} />
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
              <span aria-hidden="true" className={cn('absolute left-[4.1rem] top-3.5 h-2.5 w-2.5 rounded-full ring-4 ring-canvas', DOT[e.kind])} />
              <EventCard event={e} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function SchedulePage() {
  useDocumentTitle('Schedule');
  const { members, family } = useFamily();
  const [reference, setReference] = useState(() => new Date());
  const [view, setView] = useState<'week' | 'agenda'>('week');
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all');
  const days = useMemo(() => weekDays(reference), [reference]);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const week = useAsync(() => scheduleService.getWeek(reference), [reference.toDateString()]);

  const events = (week.data ?? []).filter((e) => memberFilter === 'all' || e.memberId === memberFilter);
  const all = week.data ?? [];
  const careItems = all.filter((e) => e.kind === 'task' || e.kind === 'conflict' || e.kind === 'completed');
  const covered = careItems.filter((e) => e.kind !== 'conflict').length;
  const coverage = careItems.length ? Math.round((covered / careItems.length) * 100) : 100;
  const conflicts = all.filter((e) => e.kind === 'conflict');
  const isThisWeek = days.some((d) => isSameDay(d, new Date()));

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

  const hoursByMember = members
    .filter((m) => m.status === 'active')
    .map((m) => ({
      member: m,
      hours: all.filter((e) => e.memberId === m.id && e.kind !== 'unavailable').reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000, 0),
    }));

  const range = `${formatShortDate(days[0].toISOString())} – ${formatShortDate(days[6].toISOString())}`;

  return (
    <>
      <PageHeader
        eyebrow="Weekly care rhythm"
        title="Family schedule"
        description={`Coordinated care for ${family?.name} · week of ${range}`}
        actions={
          <>
            <ButtonLink to="/schedule/availability" variant="soft" leftIcon={<Clock aria-hidden="true" className="h-4 w-4" />}>
              My availability
            </ButtonLink>
            <ButtonLink to="/schedule/unavailable" variant="secondary" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
              Report unavailability
            </ButtonLink>
            <ButtonLink to="/appointments/new" leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}>
              Add appointment
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
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <Card className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${coverage}% of care tasks covered`}>
                  <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-surface-sunken" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-mint-500" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(coverage / 100) * 97.4} 97.4`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">{coverage}%</span>
                </div>
                <div>
                  <p className="eyebrow text-mint-700">Care coverage</p>
                  <p className="text-sm text-ink-muted">
                    {covered} of {careItems.length} tasks have a free owner
                  </p>
                </div>
              </Card>
              {conflicts.length > 0 ? (
                <Callout
                  tone="red"
                  icon={<TriangleAlert aria-hidden="true" />}
                  title={`${conflicts.length} scheduling conflict${conflicts.length === 1 ? '' : 's'} this week`}
                  action={
                    <ButtonLink to={conflicts[0].href?.replace(/^\/tasks\/([^/]+)$/, '/tasks/$1/resolve') ?? '/priority'} size="sm">
                      Resolve
                    </ButtonLink>
                  }
                >
                  {conflicts[0].title} ({formatWeekdayShort(conflicts[0].start)}, {formatTime(conflicts[0].start)}) needs a new plan.
                </Callout>
              ) : (
                <Callout tone="mint" icon={<CalendarRange aria-hidden="true" />} title="No conflicts this week">
                  Everyone’s commitments fit together.
                </Callout>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [&>*]:shrink-0" role="group" aria-label="Filter by person">
              <ToggleChip pressed={memberFilter === 'all'} onClick={() => setMemberFilter('all')}>
                <Users aria-hidden="true" className="h-3.5 w-3.5" /> Everyone
              </ToggleChip>
              {members
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <ToggleChip key={m.id} pressed={memberFilter === m.id} onClick={() => setMemberFilter(m.id)}>
                    {m.name.split(' ')[0]}
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
                <IconButton label="Previous week" variant="secondary" size="sm" onClick={() => shiftWeek(-1)}>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </IconButton>
                <Button size="sm" variant="secondary" disabled={isThisWeek && isSameDay(selectedDay, new Date())} onClick={goToday}>
                  Today
                </Button>
                <IconButton label="Next week" variant="secondary" size="sm" onClick={() => shiftWeek(1)}>
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>

          <ul className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle lg:flex" aria-label="Legend">
            {Object.entries(KIND_STYLES).map(([k, v]) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={cn('h-3 w-3 rounded border', v.card)} /> {v.label}
              </li>
            ))}
          </ul>

          {!week.data ? (
            <Skeleton className="h-96" />
          ) : events.length === 0 ? (
            <EmptyState
              icon={<CalendarRange aria-hidden="true" />}
              title={memberFilter === 'all' ? 'Nothing planned this week' : 'Nothing planned for this person'}
              description="Tasks, appointments and reported absences will appear here."
              action={<ButtonLink to="/tasks/new">Create a task</ButtonLink>}
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
                        <p className={cn('text-[11px] font-semibold uppercase', today ? 'text-primary-700' : 'text-ink-subtle')}>{today ? 'Today' : formatWeekdayShort(d)}</p>
                        <p className="font-display text-xl">{d.getDate()}</p>
                        <p className="text-[11px] text-ink-subtle">{dayEvents.length ? `${dayEvents.length} item${dayEvents.length > 1 ? 's' : ''}` : 'Free'}</p>
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
                      <p className="text-[13px] text-ink-muted">{week.data ? `${hours.toFixed(1)} h of care planned` : 'Loading…'}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
