import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, IdCard, Pencil, Pill, Plus, SkipForward, Trash2 } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { medicationService } from '@/services/care/medicationService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { formatTime } from '@/lib/dates';
import { Avatar, Badge, Button, Callout, Card, ConfirmDialog, EmptyState, ErrorState, IconButton, ListSkeleton, PageHeader, ProgressBar, SectionHeader, useToast } from '@/components/ui';
import type { Dose, Medication } from '@/types/domain';
import { MedicationDialog } from './MedicationDialog';
import { DOSE_LABELS, scheduleText } from './medicineText';

const DAY = 86_400_000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Medicines: today's doses to tick off, how the last week went, and the schedules. Shared with whoever helps
 * (the carer) and family members with medical access, like health notes.
 */
export default function MedicinesPage() {
  useDocumentTitle('Medicines');
  const { me, personName, firstNameOf, family, canSeeMedical } = useFamily();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Medication | 'new' | null>(null);
  const [removing, setRemoving] = useState<Medication | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const data = useAsync(async () => {
    const today = startOfToday();
    const [meds, todays, week] = await Promise.all([
      medicationService.list(),
      medicationService.doses(today, new Date(today.getTime() + DAY - 1)),
      medicationService.doses(new Date(today.getTime() - 7 * DAY), new Date(today.getTime() - 1)),
    ]);
    return { meds, todays, week };
  }, []);
  useLiveRefresh(['care', 'family'], data.reload);

  const isDependant = (id: string) => Boolean(family?.dependants.some((d) => d.id === id));
  const canEdit = (personId: string) => personId === me?.id || (isDependant(personId) && canSeeMedical && me?.role !== 'observer');
  const canAdd = Boolean(me);

  const mark = async (dose: Dose, status: 'taken' | 'skipped') => {
    const key = `${dose.medicationId}@${dose.scheduledAt}`;
    setMarking(key);
    try {
      await medicationService.record(dose.medicationId, dose.scheduledAt, status);
      toast({ title: status === 'taken' ? 'Marked as taken' : 'Marked as skipped', description: `${dose.name} · ${formatTime(dose.scheduledAt)}` });
      await data.reload();
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t mark the dose', description: e instanceof Error ? e.message : undefined });
    } finally {
      setMarking(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await medicationService.remove(removing.id);
      toast({ title: 'Medicine removed', description: removing.name });
      await data.reload();
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t remove it', description: e instanceof Error ? e.message : undefined });
    } finally {
      setRemoving(null);
    }
  };

  const adherence = useMemo(() => {
    const byMed = new Map<string, { taken: number; total: number }>();
    for (const d of data.data?.week ?? []) {
      const entry = byMed.get(d.medicationId) ?? { taken: 0, total: 0 };
      entry.total++;
      if (d.status === 'taken') entry.taken++;
      byMed.set(d.medicationId, entry);
    }
    return byMed;
  }, [data.data?.week]);

  const header = (
    <PageHeader
      eyebrow={<Link to="/health">Health & food</Link>}
      title="Medicines"
      description="Today’s doses, the last seven days, and every schedule. Reminders go to the person and whoever helps them."
      actions={
        canAdd && (
          <Button onClick={() => setEditing('new')} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            Add a medicine
          </Button>
        )
      }
    />
  );

  if (data.status === 'error')
    return (
      <>
        {header}
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      </>
    );

  const meds = data.data?.meds ?? [];
  const todays = data.data?.todays ?? [];
  const missedRecently = (data.data?.week ?? []).filter((d) => d.status === 'missed' && Date.now() - new Date(d.scheduledAt).getTime() < 7 * DAY);

  return (
    <>
      {header}
      {!data.data ? (
        <ListSkeleton rows={4} />
      ) : meds.length === 0 ? (
        <EmptyState
          icon={<Pill aria-hidden="true" />}
          title="No medicines yet"
          description="Add a medicine with its times and Hearth will remind the right person, and let the family know if a dose is missed."
          action={
            <Button onClick={() => setEditing('new')} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              Add a medicine
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="today-heading">
            <SectionHeader id="today-heading" title="Today" count={todays.length} />
            {todays.length === 0 ? (
              <p className="text-sm text-ink-muted">No doses planned for today.</p>
            ) : (
              <ul className="space-y-2">
                {todays.map((d) => {
                  const key = `${d.medicationId}@${d.scheduledAt}`;
                  const label = DOSE_LABELS[d.status];
                  const markable = d.status !== 'taken' && new Date(d.scheduledAt).getTime() - Date.now() <= 2 * 3_600_000;
                  return (
                    <li key={key}>
                      <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="w-20 shrink-0 font-display text-lg tabular-nums text-ink">{formatTime(d.scheduledAt)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">
                            {d.name}
                            {d.dose && <span className="font-normal text-ink-muted"> · {d.dose}</span>}
                          </p>
                          <p className="text-[0.8125rem] text-ink-muted">
                            {d.personId === me?.id ? 'For me' : `For ${personName(d.personId)}`}
                            {d.instructions && ` · ${d.instructions}`}
                            {d.recordedById && d.status !== 'missed' && ` · marked by ${d.recordedById === me?.id ? 'you' : firstNameOf(d.recordedById)}`}
                          </p>
                        </div>
                        <Badge tone={label.tone}>{label.label}</Badge>
                        {markable && (
                          <div className="flex gap-2">
                            {d.status !== 'skipped' && (
                              <Button size="sm" variant="secondary" loading={marking === key} onClick={() => void mark(d, 'skipped')} leftIcon={<SkipForward aria-hidden="true" className="h-4 w-4" />}>
                                Skip
                              </Button>
                            )}
                            <Button size="sm" loading={marking === key} onClick={() => void mark(d, 'taken')} leftIcon={<Check aria-hidden="true" className="h-4 w-4" />}>
                              Taken
                            </Button>
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {missedRecently.length > 0 && (
            <Callout tone="amber" title={`${missedRecently.length} ${missedRecently.length === 1 ? 'dose was' : 'doses were'} not marked in the last week`}>
              If a dose was taken but not ticked, it can still be marked on the day it was due. Ask a doctor or pharmacist what to do about missed doses.
            </Callout>
          )}

          <section aria-labelledby="schedules-heading">
            <SectionHeader id="schedules-heading" title="Schedules" count={meds.length} />
            <ul className="grid gap-3 md:grid-cols-2">
              {meds.map((m) => {
                const stats = adherence.get(m.id);
                const pct = stats && stats.total ? Math.round((100 * stats.taken) / stats.total) : null;
                return (
                  <li key={m.id}>
                    <Card padding="md" className="h-full">
                      <div className="flex items-start gap-3">
                        <Avatar name={personName(m.personId)} seed={m.personId} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">
                            {m.name}
                            {m.dose && <span className="font-normal text-ink-muted"> · {m.dose}</span>}
                          </p>
                          <p className="text-[0.8125rem] text-ink-muted">{m.personId === me?.id ? 'Mine' : personName(m.personId)}</p>
                          <p className="mt-1 text-sm text-ink">{scheduleText(m)}</p>
                          {m.instructions && <p className="text-sm text-ink-muted">{m.instructions}</p>}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {!m.active && <Badge tone="neutral">Paused</Badge>}
                            {m.reminders && <Badge tone="primary">Reminders on</Badge>}
                            {m.carerId && <Badge tone="mint">Helped by {m.carerId === me?.id ? 'you' : firstNameOf(m.carerId)}</Badge>}
                            {m.endDate && <Badge tone="neutral">Until {new Date(`${m.endDate}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Badge>}
                          </div>
                        </div>
                        {canEdit(m.personId) && (
                          <div className="flex shrink-0 gap-1">
                            <IconButton label={`Change ${m.name}`} size="sm" onClick={() => setEditing(m)}>
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                            </IconButton>
                            <IconButton label={`Remove ${m.name}`} size="sm" onClick={() => setRemoving(m)}>
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </IconButton>
                          </div>
                        )}
                      </div>
                      {pct !== null && (
                        <div className="mt-4">
                          <ProgressBar value={pct} tone={pct >= 90 ? 'mint' : pct >= 60 ? 'amber' : 'red'} label={`${m.name}: doses taken in the last 7 days`} />
                          <p className="mt-1 text-xs text-ink-subtle">
                            Last 7 days: {stats?.taken} of {stats?.total} doses taken ({pct}%)
                          </p>
                        </div>
                      )}
                      <Link to={`/health/${m.personId}/emergency`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-semibold text-primary-700 hover:underline">
                        <IdCard aria-hidden="true" className="h-4 w-4" /> Emergency card
                      </Link>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <MedicationDialog open={editing !== null} onClose={() => setEditing(null)} existing={editing && editing !== 'new' ? editing : undefined} onSaved={() => void data.reload()} />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
        title={`Remove ${removing?.name ?? 'this medicine'}?`}
        description="Its schedule and the record of doses go too. To stop for a while, change it and untick “Taking it now” instead."
        confirmLabel="Remove"
        variant="danger"
      />
    </>
  );
}
