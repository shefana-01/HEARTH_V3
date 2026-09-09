import { Link } from 'react-router-dom';
import { Check, ChevronRight, Clock, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDayTime, formatTime } from '@/lib/dates';
import { PRIORITIES, TASK_CATEGORIES } from '@/constants/labels';
import { useFamily } from '@/app/FamilyProvider';
import { Avatar, Badge } from '@/components/ui';
import type { CareTask, Conflict } from '@/types/domain';

export function CategoryIcon({ category, className }: { category: CareTask['category']; className?: string }) {
  const meta = TASK_CATEGORIES[category];
  const Icon = meta.icon;
  const tones = {
    neutral: 'bg-surface-sunken text-ink-muted',
    primary: 'bg-primary-100 text-primary-700',
    rose: 'bg-rose-100 text-rose-600',
    mint: 'bg-mint-100 text-mint-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-600',
  };
  return (
    <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[meta.tone], className)}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

/**
 * One task in a list: completion toggle, title link, meta line and assignee.
 * `onToggle` is optional so read-only lists can reuse it.
 */
export function TaskRow({
  task,
  conflict,
  onToggle,
  pending,
  showDay = false,
}: {
  task: CareTask;
  conflict?: Conflict;
  onToggle?: (task: CareTask) => void;
  pending?: boolean;
  showDay?: boolean;
}) {
  const { nameOf, firstNameOf } = useFamily();
  const done = task.status === 'completed';
  const priority = PRIORITIES[task.priority];

  return (
    <li className={cn('group flex items-center gap-3 rounded-2xl border bg-surface p-3 shadow-card transition-colors sm:gap-4 sm:p-4', conflict ? 'border-red-200' : 'border-line', done && 'bg-surface-muted/60')}>
      {onToggle ? (
        <button
          type="button"
          onClick={() => onToggle(task)}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50',
            done ? 'border-mint-500 bg-mint-500 text-white' : 'border-line-strong text-transparent hover:border-mint-400 hover:text-mint-400',
          )}
        >
          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : (
        <CategoryIcon category={task.category} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={`/tasks/${task.id}`} className={cn('truncate font-semibold text-ink hover:text-primary-700 hover:underline', done && 'text-ink-subtle line-through')}>
            {task.title}
          </Link>
          {task.priority !== 'routine' && !done && <Badge tone={priority.tone}>{priority.label}</Badge>}
          {conflict && (
            <Badge tone="red" className="gap-1">
              <TriangleAlert aria-hidden="true" className="h-3 w-3" />
              {conflict.kind === 'unassigned' ? 'Needs an owner' : 'Conflict'}
            </Badge>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-subtle">
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            {done && task.completedAt ? `Done ${formatTime(task.completedAt)}` : showDay ? formatDayTime(task.start) : formatTime(task.start)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{task.assigneeId ? firstNameOf(task.assigneeId) : 'Unassigned'}</span>
        </p>
      </div>

      {task.assigneeId && <Avatar name={nameOf(task.assigneeId)} seed={task.assigneeId} size="sm" className="hidden sm:inline-flex" />}
      <Link to={`/tasks/${task.id}`} aria-label={`Open ${task.title}`} className="hidden rounded-lg p-1 text-ink-subtle hover:text-ink sm:block">
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </Link>
    </li>
  );
}
