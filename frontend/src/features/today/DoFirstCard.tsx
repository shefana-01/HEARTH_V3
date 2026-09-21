import { Link } from 'react-router-dom';
import { ArrowRightLeft, CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { formatDayTime } from '@/lib/dates';
import { Badge, Button, ButtonLink, Card } from '@/components/ui';
import { PrivateBadge } from '@/components/domain/People';
import { ScorePill } from '@/components/domain/Scores';
import type { RankedTask } from '@/types/domain';

/** The one task to start with, with the reason it comes first. */
export function DoFirstCard({ item, onDone, onAsk, donePending, askPending }: { item: RankedTask; onDone: () => void; onAsk: () => void; donePending: boolean; askPending: boolean }) {
  const { personName, me } = useFamily();
  const { task, priority, conflict, tieBreak } = item;
  const forOther = task.forId && task.forId !== me?.id;

  return (
    <Card tone="primary" padding="lg" aria-labelledby="do-first-title" as="section" className="border-primary-200 shadow-card">
      <p className="eyebrow mb-2 text-primary-700">Do first</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="do-first-title" className="min-w-0 font-display text-2xl leading-snug sm:text-3xl">
          <Link to={`/tasks/${task.id}`} className="hover:text-primary-700 hover:underline">
            {task.title}
          </Link>
        </h2>
        <ScorePill kind="priority" score={priority.score} label="Priority score" />
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <Clock aria-hidden="true" className="h-4 w-4" />
          {formatDayTime(task.start)}
        </span>
        {forOther && <Badge tone="rose">For {personName(task.forId).split(' ')[0]}</Badge>}
        {task.visibility === 'private' && <PrivateBadge />}
      </p>

      <p className="mt-3 text-[0.9375rem] text-ink">{priority.explanation}</p>
      {tieBreak && <p className="mt-1 text-sm text-ink-muted">{tieBreak}</p>}

      {conflict && (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-sm text-red-800">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <span>
              <span className="font-semibold">This one clashes with something else. </span>
              {conflict.reason}
            </span>
          </p>
          <ButtonLink to={`/tasks/${task.id}/resolve`} variant="danger" className="min-h-11 shrink-0">
            Sort it out
          </ButtonLink>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button size="lg" loading={donePending} onClick={onDone} leftIcon={<CircleCheck aria-hidden="true" className="h-5 w-5" />}>
          Mark done
        </Button>
        {task.visibility === 'family' && (
          <Button size="lg" variant="secondary" loading={askPending} onClick={onAsk} leftIcon={<ArrowRightLeft aria-hidden="true" className="h-4 w-4" />}>
            Ask someone to take it
          </Button>
        )}
      </div>
    </Card>
  );
}
