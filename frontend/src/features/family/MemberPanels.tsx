import { Link } from 'react-router-dom';
import { CalendarClock, CalendarX2, CircleCheck, ShieldCheck } from 'lucide-react';
import { formatClock, formatDayTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { SKILLS, WEEKDAY_LABELS } from '@/constants/labels';
import { TaskRow } from '@/components/domain/TaskRow';
import { Badge, ButtonLink, Callout, Card, CardHeader, FormError, Skeleton, Switch } from '@/components/ui';
import { ACCESS_SCOPES } from './accessScopes';
import type { FamilyMember, Task, Unavailability } from '@/types/domain';

function Stat({ label, value, note, loading }: { label: string; value: number; note: string; loading: boolean }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-12" />
          <Skeleton className="mt-2 h-4 w-40" />
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl">{value}</p>
          <p className="mt-1 text-sm text-ink-muted">{note}</p>
        </>
      )}
    </Card>
  );
}

export function OverviewPanel({ member, isMe, upcoming, done, away, loading }: { member: FamilyMember; isMe: boolean; upcoming: Task[]; done: Task[]; away: Unavailability[]; loading: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Stat label="Open shared tasks" value={upcoming.length} loading={loading} note={upcoming[0] ? `Next: ${upcoming[0].title}, ${formatDayTime(upcoming[0].start)}` : 'Nothing scheduled'} />
      <Stat label="Done" value={done.length} loading={loading} note="Shared tasks marked done in Hearth" />
      <Stat label="Time away" value={away.length} loading={loading} note={away[0] ? `From ${formatDayTime(away[0].start)}` : 'Nothing coming up'} />
      <Card className="lg:col-span-3">
        <CardHeader title={isMe ? 'What I can help with' : `What ${member.name.split(' ')[0]} can help with`} description="Hearth uses this when it suggests who could take a task." as="h3" />
        {member.skills.length ? (
          <ul className="flex flex-wrap gap-2">
            {member.skills.map((s) => (
              <li key={s}>
                <Badge tone="mint" size="md">
                  {SKILLS[s]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">Nothing added yet.</p>
        )}
      </Card>
    </div>
  );
}

export function SchedulePanel({ member, isMe, away }: { member: FamilyMember; isMe: boolean; away: Unavailability[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Usual week" as="h3" icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />} />
        <ul className="grid grid-cols-7 gap-1.5" aria-label="Days usually free">
          {WEEKDAY_LABELS.map((d, i) => (
            <li key={d} className={cn('rounded-xl py-2 text-center text-xs font-semibold', member.availability.days[i] ? 'bg-mint-100 text-mint-800' : 'bg-surface-sunken text-ink-subtle')}>
              {d}
              <span className="sr-only">{member.availability.days[i] ? ': free' : ': not free'}</span>
            </li>
          ))}
        </ul>
        <h4 className="mb-2 mt-5 text-sm font-semibold text-ink">Usual hours</h4>
        {member.availability.windows.length ? (
          <ul className="space-y-2">
            {member.availability.windows.map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-sm">
                <span className="font-medium text-ink">{w.label}</span>
                <span className="text-ink-muted">
                  {formatClock(w.start)} – {formatClock(w.end)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">No set hours. Any time on the days above.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Time away" as="h3" icon={<CalendarX2 aria-hidden="true" className="h-5 w-5" />} />
        {away.length ? (
          <ul className="space-y-2">
            {away.map((u) => (
              <li key={u.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
                <p className="font-medium text-ink">{u.reason}</p>
                <p className="text-ink-muted">
                  {formatDayTime(u.start)} – {formatDayTime(u.end)}
                </p>
                {u.note && <p className="mt-1 text-ink-muted">{u.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">Nothing coming up.</p>
        )}
        {isMe && (
          <ButtonLink to="/schedule/unavailable" variant="soft" className="mt-4 h-11">
            I can’t make it
          </ButtonLink>
        )}
      </Card>
    </div>
  );
}

export function TasksPanel({ upcoming, done }: { upcoming: Task[]; done: Task[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Coming up" as="h3" icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />} />
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((t) => (
              <TaskRow key={t.id} task={t} showDay />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">No shared tasks coming up.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Recently done" as="h3" icon={<CircleCheck aria-hidden="true" className="h-5 w-5" />} />
        {done.length ? (
          <ul className="space-y-2">
            {done.slice(0, 8).map((t) => (
              <TaskRow key={t.id} task={t} showDay />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">Nothing done yet.</p>
        )}
      </Card>
    </div>
  );
}

export function AccessPanel({
  member,
  canManage,
  isLead,
  error,
  pending,
  onChange,
}: {
  member: FamilyMember;
  canManage: boolean;
  isLead: boolean;
  error: string | null;
  pending: boolean;
  onChange: (key: keyof FamilyMember['access'], value: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="What they can see"
        as="h3"
        icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
        description={member.role === 'lead' ? 'The organiser always has full access.' : isLead ? 'Changes save straight away.' : 'Only the organiser can change this.'}
      />
      <FormError message={error} />
      <div className="divide-y divide-line">
        {ACCESS_SCOPES.map((s) => (
          <div key={s.key} className="py-3 first:pt-0 last:pb-0">
            <Switch checked={member.access[s.key]} onChange={(v) => onChange(s.key, v)} label={s.label} description={s.description} disabled={!canManage || pending} />
          </div>
        ))}
      </div>
      <Callout tone="neutral" className="mt-4">
        Documents marked “restricted” are only open to the people chosen on each document, whatever is set here.{' '}
        <Link to="/documents" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
          Go to documents
        </Link>
      </Callout>
    </Card>
  );
}
