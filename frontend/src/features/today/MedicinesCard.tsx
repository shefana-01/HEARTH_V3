import { Link } from 'react-router-dom';
import { Check, Pill } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { medicationService } from '@/services/care/medicationService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { formatTime } from '@/lib/dates';
import { Badge, Button, Card, CardHeader, ErrorState, ListSkeleton, useToast } from '@/components/ui';
import { DOSE_LABELS } from '@/features/health/medicineText';

/** "My day": the medicine doses left today for me and for the people I help. Hidden when there are none. */
export function MedicinesCard() {
  const { me, personName } = useFamily();
  const { toast } = useToast();
  const data = useAsync(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000 - 1);
    const [meds, doses] = await Promise.all([medicationService.list(), medicationService.doses(start, end)]);
    const mine = new Set(meds.filter((m) => m.personId === me?.id || m.carerId === me?.id).map((m) => m.id));
    return doses.filter((d) => mine.has(d.medicationId) && d.status !== 'taken' && d.status !== 'skipped');
  }, [me?.id]);
  useLiveRefresh(['care'], data.reload);
  const record = useMutation(medicationService.record);

  if (data.status === 'success' && (data.data?.length ?? 0) === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Medicines today"
        icon={<Pill aria-hidden="true" className="h-5 w-5" />}
        action={
          <Link to="/health/medicines" className="inline-flex min-h-11 items-center text-[0.8125rem] font-semibold text-primary-700 hover:underline">
            All medicines
          </Link>
        }
      />
      {data.status === 'error' ? (
        <ErrorState headingLevel="h3" title="We couldn’t load this" message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={2} />
      ) : (
        <ul className="space-y-2">
          {data.data.slice(0, 5).map((d) => (
            <li key={`${d.medicationId}@${d.scheduledAt}`} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink">{formatTime(d.scheduledAt)}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium text-ink">{d.name}</span>
                <span className="block truncate text-xs text-ink-subtle">{d.personId === me?.id ? 'For me' : `For ${personName(d.personId)}`}</span>
              </span>
              {d.status === 'upcoming' && new Date(d.scheduledAt).getTime() - Date.now() > 2 * 3_600_000 ? (
                <Badge tone={DOSE_LABELS[d.status].tone}>{DOSE_LABELS[d.status].label}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant={d.status === 'missed' ? 'secondary' : 'primary'}
                  loading={record.pending}
                  aria-label={`Mark ${d.name} at ${formatTime(d.scheduledAt)} as taken`}
                  onClick={async () => {
                    const done = await record.run(d.medicationId, d.scheduledAt, 'taken');
                    if (done) {
                      toast({ title: 'Marked as taken', description: d.name });
                      void data.reload();
                    } else toast({ tone: 'error', title: 'Couldn’t mark the dose', description: record.error ?? undefined });
                  }}
                  leftIcon={<Check aria-hidden="true" className="h-4 w-4" />}
                >
                  Taken
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
