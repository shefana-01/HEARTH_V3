import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useAsync } from '@/hooks/useAsync';
import { formatTimeRange, isSameDay, startOfDay } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Card, CardHeader, Skeleton } from '@/components/ui';
import { BlockError } from './BlockError';
import type { Task, Unavailability } from '@/types/domain';

const START_HOUR = 7;
const END_HOUR = 22;
const SPAN_MIN = (END_HOUR - START_HOUR) * 60;
const HOUR_LABELS = ['7 AM', '11 AM', '3 PM', '7 PM', '10 PM'];

/** Where a time falls on the 7 AM to 10 PM track, as a share from 0 to 1. */
function position(iso: string): number {
  const d = new Date(iso);
  return Math.max(0, Math.min(1, (d.getHours() * 60 + d.getMinutes() - START_HOUR * 60) / SPAN_MIN));
}

const endOf = (t: Task) => new Date(new Date(t.start).getTime() + t.durationMin * 60_000).toISOString();

function Timeline({ tasks, away, clashIds }: { tasks: Task[]; away: Unavailability[]; clashIds: Set<string> }) {
  const { members, firstNameOf } = useFamily();
  const people = members.filter((m) => m.status === 'active' && m.role !== 'observer');

  return (
    <div>
      <div className="mb-2 grid grid-cols-[4.5rem_1fr] text-[0.6875rem] font-semibold text-ink-subtle" aria-hidden="true">
        <span />
        <div className="flex justify-between">
          {HOUR_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
      <ul className="space-y-2.5">
        {people.map((m) => {
          const mine = tasks.filter((t) => t.assigneeId === m.id && t.status !== 'cancelled');
          const gone = away.filter((u) => u.memberId === m.id);
          return (
            <li key={m.id} className="grid grid-cols-[4.5rem_1fr] items-center">
              <span className="truncate text-[0.8125rem] font-medium text-ink">{firstNameOf(m.id)}</span>
              <div className="relative h-4 rounded-full bg-surface-sunken">
                {gone.map((u) => (
                  <span
                    key={u.id}
                    title={`Away ${formatTimeRange(u.start, u.end)}`}
                    className="absolute inset-y-0 rounded-full bg-[repeating-linear-gradient(45deg,theme(colors.rose.200),theme(colors.rose.200)_4px,theme(colors.rose.100)_4px,theme(colors.rose.100)_8px)]"
                    style={{ left: `${position(u.start) * 100}%`, width: `${Math.max(2, (position(u.end) - position(u.start)) * 100)}%` }}
                  />
                ))}
                {mine.map((t) => (
                  <span
                    key={t.id}
                    title={`${t.title} · ${formatTimeRange(t.start, endOf(t))}`}
                    className={cn('absolute inset-y-0.5 rounded-full', clashIds.has(t.id) ? 'bg-red-400' : t.status === 'completed' ? 'bg-mint-400' : 'bg-primary-400')}
                    style={{ left: `${position(t.start) * 100}%`, width: `${Math.max(2, (position(endOf(t)) - position(t.start)) * 100)}%` }}
                  />
                ))}
              </div>
              <span className="sr-only">
                {mine.length
                  ? `${mine.map((t) => `${t.title} at ${formatTimeRange(t.start)}${clashIds.has(t.id) ? ', clash' : t.status === 'completed' ? ', done' : ''}`).join('; ')}.`
                  : 'Nothing planned today.'}
                {gone.length > 0 && ` Away ${gone.map((u) => formatTimeRange(u.start, u.end)).join(', ')}.`}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle" aria-label="Key">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-4 rounded-full bg-primary-400" /> Planned
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-4 rounded-full bg-mint-400" /> Done
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-4 rounded-full bg-red-400" /> Clash
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-4 rounded-full bg-rose-200" /> Away
        </li>
      </ul>
    </div>
  );
}

/** One row per member for today: who is doing what, where tasks clash and who is away. */
export function TodayAtAGlance() {
  const data = useAsync(() => Promise.all([taskService.listTasks(), decisionService.listAttention(), scheduleService.listUnavailability()]), []);
  const [tasks = [], attention = [], absences = []] = data.data ?? [];
  const today = tasks.filter((t) => isSameDay(t.start, new Date()));
  const dayStart = startOfDay().getTime();
  const awayToday = absences.filter((u) => new Date(u.start).getTime() < dayStart + 86_400_000 && new Date(u.end).getTime() > dayStart);

  return (
    <Card as="section" aria-labelledby="glance-heading">
      <CardHeader title={<span id="glance-heading">Today at a glance</span>} description="Who is doing what, and where the gaps are." />
      {data.status === 'error' ? (
        <BlockError onRetry={data.reload} />
      ) : !data.data ? (
        <Skeleton className="h-36" />
      ) : (
        <Timeline tasks={today} away={awayToday} clashIds={new Set(attention.map((a) => a.task.id))} />
      )}
    </Card>
  );
}
