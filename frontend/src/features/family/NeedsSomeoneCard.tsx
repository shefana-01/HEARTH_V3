import { Link } from 'react-router-dom';
import { CircleCheckBig } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync } from '@/hooks/useAsync';
import { formatDayTime } from '@/lib/dates';
import { Card, CardHeader, ListSkeleton } from '@/components/ui';
import { BlockError } from './BlockError';

/** The three most pressing shared tasks that cannot go ahead as planned. */
export function NeedsSomeoneCard() {
  const { firstNameOf } = useFamily();
  const attention = useAsync(() => decisionService.listAttention(), []);
  const items = (attention.data ?? []).slice(0, 3);

  return (
    <Card as="section" aria-labelledby="needs-heading">
      <CardHeader
        title={<span id="needs-heading">Needs someone</span>}
        action={
          items.length > 0 && (
            <Link to="/priority" className="inline-flex min-h-11 items-center text-[0.8125rem] font-semibold text-primary-700 hover:underline">
              See all
            </Link>
          )
        }
      />
      {attention.status === 'error' ? (
        <BlockError onRetry={attention.reload} />
      ) : !attention.data ? (
        <ListSkeleton rows={2} />
      ) : items.length === 0 ? (
        <p className="flex items-center gap-3 rounded-xl bg-mint-50 px-3.5 py-3 text-sm font-medium text-mint-800">
          <CircleCheckBig aria-hidden="true" className="h-5 w-5 shrink-0 text-mint-600" />
          Everything has someone today.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map(({ conflict, task, topCandidate }) => (
            <li key={conflict.id}>
              <Link to={`/tasks/${task.id}/resolve`} className="block rounded-xl border border-line bg-surface-muted p-3.5 transition-colors hover:border-primary-200 hover:bg-primary-50/60">
                <p className="font-semibold text-ink">{task.title}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{conflict.reason}</p>
                <p className="mt-1.5 text-xs text-ink-subtle">
                  {formatDayTime(task.start)}
                  {topCandidate && ` · Best match: ${firstNameOf(topCandidate.memberId)}, ${topCandidate.score}/100`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
