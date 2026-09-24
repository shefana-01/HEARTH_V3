import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CalendarCheck2, CalendarPlus, CircleCheck, Circle, Clock, Stethoscope, UserRound, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { dayDiff, formatDayTime, formatDuration, formatTime, formatWeekday } from '@/lib/dates';
import { downloadIcs } from '@/lib/ics';
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, ListSkeleton, PageHeader, ProgressBar, SegmentedControl, Select } from '@/components/ui';
import { PrivateBadge } from '@/components/domain/People';
import type { Appointment } from '@/types/domain';

const endOf = (a: Appointment) => new Date(a.start).getTime() + a.durationMin * 60_000;

function DateBlock({ a }: { a: Appointment }) {
  const d = new Date(a.start);
  return (
    <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-sunken px-2 py-3 text-center text-ink-muted">
      <span className="text-[0.6875rem] font-bold uppercase">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      <span className="font-display text-3xl leading-none text-ink">{d.getDate()}</span>
      <span className="text-[0.6875rem]">{formatWeekday(a.start).slice(0, 3)}</span>
    </div>
  );
}

export default function AppointmentsPage() {
  useDocumentTitle('Appointments');
  const { me, people, personName, firstNameOf } = useFamily();
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [person, setPerson] = useState('all');
  const list = useAsync(() => appointmentService.list(), []);

  const all = list.data ?? [];
  const upcoming = all.filter((a) => endOf(a) >= Date.now());
  const past = all.filter((a) => endOf(a) < Date.now()).reverse();
  const shown = (view === 'upcoming' ? upcoming : past).filter((a) => person === 'all' || a.forId === person);
  const next = view === 'upcoming' ? shown[0] : undefined;
  const rest = next ? shown.slice(1) : shown;
  const withPrep = upcoming.filter((a) => a.prep.length).slice(0, 2);

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Visits and check-ups for everyone in your family."
        actions={
          <ButtonLink to="/appointments/new" leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}>
            Add appointment
          </ButtonLink>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label="Which appointments"
          value={view}
          onChange={setView}
          options={[
            { value: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { value: 'past', label: `Past (${past.length})` },
          ]}
        />
        <div className="w-full sm:w-56">
          <label htmlFor="person-filter" className="sr-only">
            Filter by person
          </label>
          <Select id="person-filter" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="all">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                For {p.id === me?.id ? 'me' : p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {list.status === 'error' ? (
        <ErrorState message={list.error?.message} onRetry={list.reload} />
      ) : !list.data ? (
        <ListSkeleton rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Stethoscope aria-hidden="true" />}
          title={view === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
          description={view === 'upcoming' ? 'Add visits so the family knows who they are for and who is going along.' : 'Visits that have happened will appear here.'}
          action={view === 'upcoming' ? <ButtonLink to="/appointments/new">Add an appointment</ButtonLink> : undefined}
        />
      ) : (
        <div className="space-y-6">
          {next && (
            <Card padding="lg" className="relative overflow-hidden">
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-100 blur-2xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="eyebrow text-rose-600">Next visit · {next.specialty || 'Appointment'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {next.visibility === 'private' && <PrivateBadge />}
                    {next.prep.length > 0 && (
                      <Badge tone={next.prep.every((p) => p.done) ? 'mint' : 'amber'} dot size="md">
                        {next.prep.filter((p) => p.done).length} of {next.prep.length} prep tasks done
                      </Badge>
                    )}
                  </div>
                </div>
                <h2 className="mt-2 font-display text-3xl">{next.title}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
                  <UserRound aria-hidden="true" className="h-4 w-4" /> For {personName(next.forId)}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="flex gap-3 rounded-2xl bg-surface-muted p-4">
                    <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    <div>
                      <p className="eyebrow">Date & time</p>
                      <p className="font-semibold text-ink">{formatDayTime(next.start)}</p>
                      <p className="text-[0.8125rem] text-primary-700">{dayDiff(next.start) > 1 ? `In ${dayDiff(next.start)} days` : formatDuration(next.durationMin)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-surface-muted p-4">
                    <Building2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    <div className="min-w-0">
                      <p className="eyebrow">Where</p>
                      <p className="font-semibold text-ink">{next.provider}</p>
                      <p className="truncate text-[0.8125rem] text-ink-muted">{next.location}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-surface-muted p-4">
                    <Users aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    <div>
                      <p className="eyebrow">Going along</p>
                      <p className="font-semibold text-ink">{next.escortId ? personName(next.escortId) : 'Nobody yet'}</p>
                      <p className="text-[0.8125rem] text-ink-muted">{next.escortId ? 'Told about this visit' : 'Add someone by editing the visit'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="secondary"
                    leftIcon={<CalendarCheck2 aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => downloadIcs({ title: next.title, start: next.start, durationMin: next.durationMin, location: next.location, description: next.provider })}
                  >
                    Add to calendar
                  </Button>
                  <ButtonLink to={`/appointments/${next.id}`} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                    View details
                  </ButtonLink>
                </div>
              </div>
            </Card>
          )}

          {rest.length > 0 && (
            <ul className="space-y-3">
              {rest.map((a) => (
                <li key={a.id}>
                  <Card padding="sm" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:p-5">
                    <DateBlock a={a} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.visibility === 'private' && <PrivateBadge />}
                        {a.prep.length > 0 && (
                          <Badge tone={a.prep.every((p) => p.done) ? 'mint' : 'primary'}>
                            Prep {a.prep.filter((p) => p.done).length}/{a.prep.length}
                          </Badge>
                        )}
                        <span className="text-[0.8125rem] text-ink-subtle">
                          {formatTime(a.start)} · {formatDuration(a.durationMin)}
                        </span>
                      </div>
                      <Link to={`/appointments/${a.id}`} className="mt-1 block font-display text-lg hover:underline">
                        {a.title}
                      </Link>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <UserRound aria-hidden="true" className="h-3.5 w-3.5" /> For {personName(a.forId)}
                        </span>
                        {a.escortId && (
                          <span className="inline-flex items-center gap-1">
                            <Users aria-hidden="true" className="h-3.5 w-3.5" /> With {firstNameOf(a.escortId)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Building2 aria-hidden="true" className="h-3.5 w-3.5" /> {a.provider}
                        </span>
                      </p>
                    </div>
                    <ButtonLink to={`/appointments/${a.id}`} variant="secondary" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                      Details
                    </ButtonLink>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {view === 'upcoming' && withPrep.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {withPrep.map((a) => {
                const done = a.prep.filter((p) => p.done).length;
                return (
                  <Card key={a.id}>
                    <CardHeader
                      as="h3"
                      title={`${a.specialty || a.title} readiness`}
                      description={`For ${personName(a.forId)} · ${formatDayTime(a.start)}`}
                      action={<Badge tone={done === a.prep.length ? 'mint' : 'rose'}>{done === a.prep.length ? 'Ready' : 'Action needed'}</Badge>}
                    />
                    <ProgressBar value={done} max={a.prep.length} tone={done === a.prep.length ? 'mint' : 'rose'} label={`${a.title} preparation`} className="mb-3" />
                    <ul className="space-y-1.5 text-sm">
                      {a.prep.map((p) => (
                        <li key={p.id} className="flex items-start gap-2 text-ink-muted">
                          {p.done ? (
                            <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                          ) : (
                            <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                          )}
                          <span className={p.done ? 'line-through' : ''}>{p.label}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          )}

          {view === 'upcoming' && (
            <Card tone="muted" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">Shared visits also appear on the family schedule. Private ones only show as busy.</p>
              <ButtonLink to="/schedule" variant="secondary">
                Open schedule
              </ButtonLink>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
