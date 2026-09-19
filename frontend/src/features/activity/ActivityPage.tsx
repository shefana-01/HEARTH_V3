import { useMemo, useState } from 'react';
import { ArrowRight, Download, History, Search } from 'lucide-react';
import { auditService } from '@/services/audit/auditService';
import { useFamily } from '@/app/FamilyProvider';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatFullDate, formatTime, isSameDay } from '@/lib/dates';
import { downloadFile, slugify, toCsv } from '@/lib/download';
import { cn } from '@/lib/cn';
import { AUDIT_CATEGORIES } from '@/constants/labels';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, ListSkeleton, PageHeader, Select, ToggleChip } from '@/components/ui';
import type { AuditCategory, AuditEvent } from '@/types/domain';

type Range = '1' | '7' | '30' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '1', label: 'Past 24 hours' },
  { value: '7', label: 'Past 7 days' },
  { value: '30', label: 'Past 30 days' },
  { value: 'all', label: 'All time' },
];

function dayHeading(iso: string): string {
  const d = new Date(iso);
  if (isSameDay(d, new Date())) return 'Today';
  if (isSameDay(d, new Date(Date.now() - 86_400_000))) return 'Yesterday';
  return formatFullDate(iso);
}

export default function ActivityPage() {
  useDocumentTitle('Activity history');
  const { family, members, nameOf } = useFamily();
  const data = useAsync(() => auditService.list(), []);
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');
  const [actor, setActor] = useState('all');
  const [range, setRange] = useState<Range>('30');
  const [query, setQuery] = useState('');

  const events = useMemo(() => data.data ?? [], [data.data]);
  const filtered = useMemo(() => {
    const since = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000;
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (actor === 'all' || e.actorId === actor) &&
        new Date(e.at).getTime() >= since &&
        (!q || `${e.action} ${e.subject} ${e.before ?? ''} ${e.after ?? ''} ${nameOf(e.actorId)}`.toLowerCase().includes(q)),
    );
  }, [events, category, actor, range, query, nameOf]);

  const groups = useMemo(() => {
    const map = new Map<string, AuditEvent[]>();
    for (const e of filtered) {
      const key = dayHeading(e.at);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [filtered]);

  // Members who appear in the log, including people since removed.
  const actorIds = [...new Set([...members.map((m) => m.id), ...events.map((e) => e.actorId)])].filter((id) => events.some((e) => e.actorId === id));

  const exportLog = () => {
    const rows = [
      ['Date', 'Time', 'Who', 'Category', 'Action', 'Subject', 'Before', 'After'],
      ...filtered.map((e) => [e.at.slice(0, 10), formatTime(e.at), nameOf(e.actorId), AUDIT_CATEGORIES[e.category].label, e.action, e.subject, e.before ?? '', e.after ?? '']),
    ];
    downloadFile(`${slugify(family?.name ?? 'family')}-activity.csv`, toCsv(rows), 'text/csv');
  };

  const filtersActive = category !== 'all' || actor !== 'all' || range !== '30' || query !== '';

  return (
    <>
      <PageHeader
        eyebrow={family?.name}
        title="Activity history"
        description="A record of what changed in your circle, who changed it and when."
        actions={
          <Button variant="secondary" onClick={exportLog} disabled={!filtered.length} leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}>
            Export CSV
          </Button>
        }
      />

      <Card as="section" aria-label="Filters" className="mb-6" padding="sm">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          <ToggleChip pressed={category === 'all'} onClick={() => setCategory('all')}>
            All activity
          </ToggleChip>
          {(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((c) => (
            <ToggleChip key={c} pressed={category === c} onClick={() => setCategory(c)}>
              {AUDIT_CATEGORIES[c].label}
            </ToggleChip>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="sr-only" htmlFor="activity-search">
            Search activity
          </label>
          <Input
            id="activity-search"
            type="search"
            placeholder="Search activity"
            leftIcon={<Search aria-hidden="true" className="h-4 w-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="sr-only" htmlFor="activity-actor">
            Who
          </label>
          <Select id="activity-actor" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="all">Everyone</option>
            {actorIds.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="activity-range">
            Time period
          </label>
          <Select id="activity-range" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<History aria-hidden="true" />}
          title={events.length ? 'No activity matches these filters' : 'No activity yet'}
          description={events.length ? 'Try a longer time period or clear the filters.' : 'Changes to tasks, schedules and care records will be listed here.'}
          action={
            filtersActive && events.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setCategory('all');
                  setActor('all');
                  setRange('all');
                  setQuery('');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
            {filtered.length} event{filtered.length === 1 ? '' : 's'}
          </p>
          {groups.map(([day, list]) => (
            <section key={day} aria-labelledby={`day-${slugify(day)}`} className="mb-6">
              <h2 id={`day-${slugify(day)}`} className="eyebrow mb-2">
                {day}
              </h2>
              <Card padding="none">
                <ol className="divide-y divide-line">
                  {list.map((e) => {
                    const meta = AUDIT_CATEGORIES[e.category];
                    const hasChange = Boolean(e.before || e.after);
                    return (
                      <li key={e.id} className="flex gap-3 p-4 sm:gap-4">
                        <Avatar name={nameOf(e.actorId)} size="sm" className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] text-ink">
                            <span className="font-semibold">{nameOf(e.actorId)}</span> {e.action.charAt(0).toLowerCase() + e.action.slice(1)}
                            {e.subject && (
                              <>
                                {' '}
                                <span className="font-semibold">{e.subject}</span>
                              </>
                            )}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                            <time dateTime={e.at}>{formatTime(e.at)}</time>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </p>
                          {hasChange && (
                            <details className="group mt-2">
                              <summary className="cursor-pointer text-[13px] font-semibold text-primary-700">Change details</summary>
                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                <div className={cn('rounded-xl px-3 py-2 text-sm', e.before ? 'bg-surface-sunken text-ink-muted' : 'bg-surface-muted text-ink-subtle')}>
                                  <span className="eyebrow block">Before</span>
                                  {e.before || '—'}
                                </div>
                                <ArrowRight aria-hidden="true" className="hidden h-4 w-4 text-ink-subtle sm:block" />
                                <div className="rounded-xl bg-mint-50 px-3 py-2 text-sm text-ink">
                                  <span className="eyebrow block">After</span>
                                  {e.after || '—'}
                                </div>
                              </div>
                            </details>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </section>
          ))}
        </>
      )}
    </>
  );
}
