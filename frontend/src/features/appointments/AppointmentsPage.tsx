import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CalendarCheck2, CalendarPlus, Car, CircleCheck, Circle, Clock, Stethoscope, UserRound } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { dayDiff, formatDayTime, formatDuration, formatTime, formatWeekday } from '@/lib/dates';
import { downloadIcs } from '@/lib/ics';
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, ListSkeleton, PageHeader, ProgressBar, SegmentedControl, Select } from '@/components/ui';
import type { Appointment } from '@/types/domain';

const endOf = (a: Appointment) => new Date(a.start).getTime() + a.durationMin * 60_000;

function DateBlock({ a, highlight }: { a: Appointment; highlight?: boolean }) {
  const d = new Date(a.start);
  return (
    <div className={`flex w-20 shrink-0 flex-col items-center justify-center rounded-2xl px-2 py-3 text-center ${highlight ? 'bg-rose-100 text-rose-700' : 'bg-surface-sunken text-ink-muted'}`}>
      <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      <span className="font-display text-3xl leading-none text-ink">{d.getDate()}</span>
      <span className="text-[11px]">{formatWeekday(a.start).slice(0, 3)}</span>
    </div>
  );
}

export default function AppointmentsPage() {
  useDocumentTitle('Appointments');
  const { family, members, nameOf, firstNameOf } = useFamily();
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [person, setPerson] = useState('all');
  const list = useAsync(() => appointmentService.list(), []);

  const all = list.data ?? [];
  const upcoming = all.filter((a) => endOf(a) >= Date.now());
  const past = all.filter((a) => endOf(a) < Date.now()).reverse();
  const shown = (view === 'upcoming' ? upcoming : past).filter((a) => person === 'all' || a.escortId === person);
  const next = view === 'upcoming' ? shown[0] : undefined;
  const rest = next ? shown.slice(1) : shown;
  const withPrep = upcoming.filter((a) => a.prep.length).slice(0, 2);

  return (
    <>
      <PageHeader
        eyebrow="Clinical agenda"
        title="Appointments & visits"
        description={`Clinic visits, reviews and health check-ins for ${family?.recipient.name}.`}
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
          <label htmlFor="escort-filter" className="sr-only">
            Filter by escort
          </label>
          <Select id="escort-filter" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="all">All family members</option>
            {members
              .filter((m) => m.status === 'active')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  Escort: {m.name}
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
          description={view === 'upcoming' ? 'Add clinic visits so the circle knows who is going and what to bring.' : 'Visits you’ve attended will appear here.'}
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
                  {next.prep.length > 0 && (
                    <Badge tone={next.prep.every((p) => p.done) ? 'mint' : 'amber'} dot size="md">
                      {next.prep.filter((p) => p.done).length} of {next.prep.length} prep tasks done
                    </Badge>
                  )}
                </div>
                <h2 className="mt-2 font-display text-3xl">{next.title}</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="flex gap-3 rounded-2xl bg-surface-muted p-4">
                    <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    <div>
                      <p className="eyebrow">Date & time</p>
                      <p className="font-semibold text-ink">{formatDayTime(next.start)}</p>
                      <p className="text-[13px] text-primary-700">{dayDiff(next.start) > 1 ? `In ${dayDiff(next.start)} days` : formatDuration(next.durationMin)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-surface-muted p-4">
                    <Building2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    <div className="min-w-0">
                      <p className="eyebrow">With</p>
                      <p className="font-semibold text-ink">{next.provider}</p>
                      <p className="truncate text-[13px] text-ink-muted">{next.location}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-surface-muted p-4">
                    <Car aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
                    <div>
                      <p className="eyebrow">Escort</p>
                      <p className="font-semibold text-ink">{next.escortId ? nameOf(next.escortId) : 'Not assigned'}</p>
                      <p className={`text-[13px] ${next.escortId ? 'text-mint-700' : 'text-red-600'}`}>{next.escortId ? 'Assigned' : 'Someone needs to go'}</p>
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
                        {a.prep.length > 0 && (
                          <Badge tone={a.prep.every((p) => p.done) ? 'mint' : 'primary'}>
                            Prep {a.prep.filter((p) => p.done).length}/{a.prep.length}
                          </Badge>
                        )}
                        <span className="text-[13px] text-ink-subtle">
                          {formatTime(a.start)} · {formatDuration(a.durationMin)}
                        </span>
                      </div>
                      <Link to={`/appointments/${a.id}`} className="mt-1 block font-display text-lg hover:underline">
                        {a.title}
                      </Link>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <UserRound aria-hidden="true" className="h-3.5 w-3.5" /> Escort: {a.escortId ? firstNameOf(a.escortId) : 'not assigned'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Building2 aria-hidden="true" className="h-3.5 w-3.5" /> {a.provider}
                        </span>
                      </p>
                    </div>
                    <ButtonLink to={`/appointments/${a.id}`} variant="secondary" size="sm" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
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
                      description={formatDayTime(a.start)}
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
              <p className="text-sm text-ink-muted">Every visit also appears on the shared family schedule.</p>
              <ButtonLink to="/schedule" variant="secondary" size="sm">
                Open schedule
              </ButtonLink>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
