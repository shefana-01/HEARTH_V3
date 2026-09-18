import { useEffect, useState } from 'react';
import { CalendarCheck2, CalendarX2, CircleCheck, Flag, Moon, Plus, RefreshCw, Sun, Sunset, Trash2 } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { scheduleService } from '@/services/schedule/scheduleService';
import { taskService } from '@/services/tasks/taskService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMinWidth } from '@/hooks/useMediaQuery';
import { formatClock, formatDayTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { WEEKDAY_LABELS } from '@/constants/labels';
import { availabilityFit } from '@/services/decision/engine';
import { ActionBar, Avatar, Badge, Button, ButtonLink, Card, CardHeader, ErrorState, FormError, IconButton, Input, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import type { TimeWindow, WeeklyAvailability } from '@/types/domain';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function windowIcon(start: string) {
  const h = Number(start.slice(0, 2));
  return h < 12 ? Sun : h < 17 ? Sunset : Moon;
}

function validateWindows(windows: TimeWindow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  windows.forEach((w) => {
    if (!w.label.trim()) errors[w.id] = 'Give this time a name.';
    else if (toMin(w.end) <= toMin(w.start)) errors[w.id] = 'The end time must be after the start time.';
  });
  const sorted = [...windows].sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMin(sorted[i].start) < toMin(sorted[i - 1].end)) errors[sorted[i].id] ??= `Overlaps “${sorted[i - 1].label}”.`;
  }
  return errors;
}

export default function AvailabilityPage() {
  useDocumentTitle('My availability');
  const { me, members, refresh, firstNameOf } = useFamily();
  const { toast } = useToast();
  const data = useAsync(() => Promise.all([taskService.listTasks({ assigneeId: me?.id }), scheduleService.listUnavailability(me?.id)]), [me?.id]);
  const [draft, setDraft] = useState<WeeklyAvailability | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation((a: WeeklyAvailability) => scheduleService.saveAvailability(me!.id, a));
  const desktop = useMinWidth('lg');
  const removeAbsence = useMutation(scheduleService.removeUnavailability);

  useEffect(() => {
    if (me && !draft) setDraft(structuredClone(me.availability));
  }, [me, draft]);

  if (!me || !draft) return <PageSkeleton />;
  if (data.status === 'error') return <ErrorState headingLevel="h1" message={data.error?.message} onRetry={data.reload} />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(me.availability);
  const [myTasks = [], absences = []] = data.data ?? [];
  const upcomingTasks = myTasks.filter((t) => t.status === 'scheduled' && new Date(t.start).getTime() > Date.now());
  const outside = upcomingTasks.filter((t) => availabilityFit({ ...me, availability: draft }, new Date(t.start).getTime(), new Date(t.start).getTime() + t.durationMin * 60_000) < 1);
  const futureAbsences = absences.filter((u) => new Date(u.end).getTime() > Date.now());

  const updateWindow = (id: string, patch: Partial<TimeWindow>) => setDraft({ ...draft, windows: draft.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) });

  const onSave = async () => {
    const e = validateWindows(draft.windows);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!draft.days.some(Boolean)) {
      toast({ tone: 'error', title: 'Choose at least one day' });
      return;
    }
    const saved = await save.run({ ...draft, windows: [...draft.windows].sort((a, b) => toMin(a.start) - toMin(b.start)) });
    if (saved) {
      await refresh();
      setDraft(saved);
      toast({ title: 'Availability saved', description: 'The circle will see your updated times.' });
    }
  };

  const others = members.filter((m) => m.id !== me.id && m.status === 'active' && m.role !== 'observer');
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Schedule', to: '/schedule' }, { label: 'My availability' }]}
        title="My care availability"
        description="Set when you’re usually free to help. Hearth uses this to suggest fair plans and spot clashes."
        actions={
          <>
            <ButtonLink to="/schedule/unavailable" variant="secondary" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
              Mark unavailable
            </ButtonLink>
            <Button className="hidden lg:inline-flex" onClick={onSave} loading={save.pending} disabled={!dirty} leftIcon={<CircleCheck aria-hidden="true" className="h-4 w-4" />}>
              Save availability
            </Button>
          </>
        }
      />
      {/* Phones & tablets: a save bar appears once there are unsaved changes. */}
      {dirty && !desktop && (
        <ActionBar className="flex-row">
          <Button variant="secondary" onClick={() => setDraft(structuredClone(me.availability))}>
            Discard
          </Button>
          <Button className="flex-1" onClick={onSave} loading={save.pending} leftIcon={<CircleCheck aria-hidden="true" className="h-4 w-4" />}>
            Save availability
          </Button>
        </ActionBar>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Weekly routine" description="Your standing pattern, repeated every week." icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />} />
            <FormError message={save.error} />
            <fieldset className="mb-6">
              <legend className="mb-2 text-sm font-semibold text-ink">Days I can usually help</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={draft.days[i]}
                    onClick={() => setDraft({ ...draft, days: draft.days.map((v, j) => (j === i ? !v : v)) })}
                    className={cn(
                      'h-10 w-12 rounded-xl border text-sm font-semibold transition-colors',
                      draft.days[i] ? 'border-primary-500 bg-primary-600 text-white' : 'border-line bg-surface text-ink-muted hover:border-primary-300',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Time windows</h3>
              <span className="text-xs text-ink-subtle">{draft.windows.length} configured</span>
            </div>
            {draft.windows.length === 0 && <p className="mb-3 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">No times yet — Hearth will treat your availability as unknown.</p>}
            <ul className="space-y-3">
              {draft.windows.map((w) => {
                const Icon = windowIcon(w.start);
                const err = errors[w.id];
                return (
                  <li key={w.id} className={cn('rounded-2xl border-l-4 bg-surface-muted p-4', err ? 'border-red-400' : 'border-mint-400')}>
                    <div className="grid items-end gap-3 sm:grid-cols-[auto_minmax(0,1fr)_8rem_8rem_auto]">
                      <Icon aria-hidden="true" className="mb-3 hidden h-5 w-5 text-mint-600 sm:block" />
                      <label className="text-[13px] font-semibold text-ink">
                        Name
                        <Input className="mt-1" value={w.label} onChange={(e) => updateWindow(w.id, { label: e.target.value })} aria-invalid={err ? true : undefined} />
                      </label>
                      <label className="text-[13px] font-semibold text-ink">
                        From
                        <Input className="mt-1" type="time" step={900} value={w.start} onChange={(e) => updateWindow(w.id, { start: e.target.value })} />
                      </label>
                      <label className="text-[13px] font-semibold text-ink">
                        To
                        <Input className="mt-1" type="time" step={900} value={w.end} onChange={(e) => updateWindow(w.id, { end: e.target.value })} />
                      </label>
                      <IconButton label={`Remove ${w.label || 'time window'}`} onClick={() => setDraft({ ...draft, windows: draft.windows.filter((x) => x.id !== w.id) })}>
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    </div>
                    {err && <p className="mt-2 text-[13px] font-medium text-red-600">{err}</p>}
                  </li>
                );
              })}
            </ul>
            <Button
              variant="soft"
              className="mt-4"
              leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setDraft({ ...draft, windows: [...draft.windows, { id: crypto.randomUUID(), label: 'Available', start: '18:00', end: '20:00' }] })}
            >
              Add a time window
            </Button>
          </Card>

          <Card tone={outside.length ? 'amber' : 'primary'}>
            <CardHeader
              title="Existing commitments checked"
              icon={<CalendarCheck2 aria-hidden="true" className="h-5 w-5" />}
              action={<Badge tone={outside.length ? 'amber' : 'mint'}>{outside.length ? `${outside.length} outside` : 'All fit'}</Badge>}
            />
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-ink-muted">You have no upcoming tasks.</p>
            ) : outside.length ? (
              <ul className="space-y-1 text-sm text-ink-muted">
                {outside.map((t) => (
                  <li key={t.id}>
                    <span className="font-semibold text-ink">{t.title}</span> — {formatDayTime(t.start)} is outside these times.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">All {upcomingTasks.length} of your upcoming tasks fit inside these times.</p>
            )}
          </Card>

          {futureAbsences.length > 0 && (
            <Card>
              <CardHeader title="Reported time away" as="h3" />
              <ul className="space-y-2">
                {futureAbsences.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold text-ink">{formatDayTime(u.start)}</span> → {formatDayTime(u.end)}
                      {u.reason && <span className="text-ink-muted"> · {u.reason}</span>}
                    </span>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      loading={removeAbsence.pending}
                      onClick={async () => {
                        await removeAbsence.run(u.id);
                        data.reload();
                        toast({ title: 'Time away removed' });
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Circle availability today" description="When others are usually free." />
            {others.length ? (
              <ul className="space-y-2.5">
                {others.map((m) => {
                  const free = m.availability.days[todayIndex] ? m.availability.windows : [];
                  return (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                      <Avatar name={m.name} seed={m.id} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{firstNameOf(m.id)}</span>
                        <span className="block truncate text-xs text-ink-subtle">{m.relation || m.focus}</span>
                      </span>
                      <Badge tone={free.length ? 'mint' : 'neutral'}>
                        {free.length ? free.map((w) => `${formatClock(w.start)}–${formatClock(w.end)}`).join(', ') : m.availability.windows.length ? 'Not today' : 'Not shared'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">Invite people to your circle to see their availability.</p>
            )}
          </Card>
          <Card>
            <p className="font-display text-lg">Feeling overwhelmed?</p>
            <p className="mt-1 text-sm text-ink-muted">Caregiving needs balance. Flag time away and Hearth will find someone to cover — without guilt.</p>
            <ButtonLink to="/schedule/unavailable" variant="soft" block className="mt-4" leftIcon={<Flag aria-hidden="true" className="h-4 w-4" />}>
              Report unavailability
            </ButtonLink>
          </Card>
          <Card tone="mint" className="text-sm text-mint-800">
            Availability changes are shared quietly with your circle — no noisy alarms.
          </Card>
        </aside>
      </div>
    </>
  );
}
