import { Link } from 'react-router-dom';
import { CalendarClock, Info, Sparkles } from 'lucide-react';
import { formatDayTime, formatTime } from '@/lib/dates';
import { Card, CardHeader } from '@/components/ui';
import { PrivateBadge } from '@/components/domain/People';
import type { Task } from '@/types/domain';

/** What the chosen time takes out: shared tasks Hearth finds someone for, and private ones only their owner can move. */
export function AffectedTasks({ range, shared, mine }: { range: { start: Date; end: Date } | null; shared: Task[]; mine: Task[] }) {
  return (
    <Card>
      <CardHeader
        title="What this affects"
        icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />}
        description={range ? `${formatDayTime(range.start.toISOString())} – ${formatTime(range.end.toISOString())}` : undefined}
      />
      {shared.length + mine.length === 0 && (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
          None of your tasks fall in this time.
        </p>
      )}
      {shared.length > 0 && (
        <section aria-labelledby="affected-shared">
          <h3 id="affected-shared" className="text-sm font-semibold text-ink">
            Shared tasks
          </h3>
          <p className="mb-2 text-[0.8125rem] text-ink-muted">Hearth will look for someone to take these.</p>
          <ul className="space-y-2">
            {shared.map((t) => (
              <li key={t.id} className="rounded-xl bg-rose-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                <p className="text-xs text-ink-subtle">{formatDayTime(t.start)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-[0.8125rem] text-primary-800">
            <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Hearth will rank who is free, not overloaded and able to help.
          </p>
        </section>
      )}
      {mine.length > 0 && (
        <section aria-labelledby="affected-private" className={shared.length > 0 ? 'mt-5' : undefined}>
          <h3 id="affected-private" className="text-sm font-semibold text-ink">
            Private tasks
          </h3>
          <p className="mb-2 text-[0.8125rem] text-ink-muted">Only you can move these.</p>
          <ul className="space-y-2">
            {mine.map((t) => (
              <li key={t.id}>
                <Link to={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2.5 hover:bg-surface-sunken">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{t.title}</span>
                    <span className="block text-xs text-ink-subtle">{formatDayTime(t.start)}</span>
                  </span>
                  <PrivateBadge />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
