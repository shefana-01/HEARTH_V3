import { Link } from 'react-router-dom';
import { Check, Clock, TriangleAlert } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { PRIORITY_WEIGHTS } from '@/services/decision/decisionService';
import { cn } from '@/lib/cn';
import { dayDiff, formatDayTime, formatTime } from '@/lib/dates';
import { Badge, Disclosure, SectionHeader } from '@/components/ui';
import { PrivateBadge } from '@/components/domain/People';
import { ScorePill } from '@/components/domain/Scores';
import type { Advice, RankedTask, Task } from '@/types/domain';

const GROUPS: { advice: Advice; title: string; help: string }[] = [
  { advice: 'now', title: 'Do now', help: 'Starting within two hours, or already due.' },
  { advice: 'next', title: 'Later today', help: 'Still to come today.' },
  { advice: 'later', title: 'Can wait', help: 'From tomorrow on. These can wait without holding anything up.' },
];

function RankedRow({ item, onToggle, pending }: { item: RankedTask; onToggle: (task: Task) => void; pending: boolean }) {
  const { personName, me } = useFamily();
  const { task, rank, priority, conflict, tieBreak } = item;
  const forOther = task.forId && task.forId !== me?.id;

  return (
    <li className={cn('flex items-start gap-1 rounded-2xl border bg-surface p-2 shadow-card sm:gap-2 sm:p-3', conflict ? 'border-red-200' : 'border-line')}>
      <span className="flex h-11 w-6 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-ink-subtle">
        <span className="sr-only">Number </span>
        {rank}
      </span>
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={pending}
        aria-label={`Mark “${task.title}” as done`}
        className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-line-strong text-transparent transition-colors group-hover:border-mint-400 group-hover:text-mint-400">
          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
        </span>
      </button>

      <div className="min-w-0 flex-1 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={`/tasks/${task.id}`} className="font-semibold text-ink hover:text-primary-700 hover:underline">
            {task.title}
          </Link>
          {task.visibility === 'private' && <PrivateBadge />}
          {forOther && <Badge tone="rose">for {personName(task.forId).split(' ')[0]}</Badge>}
          {conflict && (
            <Badge tone="red" className="gap-1">
              <TriangleAlert aria-hidden="true" className="h-3 w-3" />
              Clash
            </Badge>
          )}
        </div>
        <p className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] text-ink-subtle">
          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
          {dayDiff(task.start) === 0 ? formatTime(task.start) : formatDayTime(task.start)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{priority.explanation}</p>
        {tieBreak && <p className="mt-0.5 text-xs text-ink-subtle">{tieBreak}</p>}
      </div>

      <div className="shrink-0 py-2.5 pr-1.5">
        <ScorePill kind="priority" score={priority.score} label="Priority score" />
      </div>
    </li>
  );
}

function HowItIsDecided() {
  const w = PRIORITY_WEIGHTS;
  const factors = [
    { label: 'Deadline', text: 'how soon it is due', weight: w.deadline },
    { label: 'How much it matters', text: 'for someone’s health, safety or plans', weight: w.criticality },
    { label: 'What depends on it', text: 'such as an appointment', weight: w.dependency },
    { label: 'How hard it is to hand over', text: 'to someone else', weight: w.reassignment },
    { label: 'Clash', text: 'with something else on your schedule', weight: w.conflict },
  ];
  return (
    <Disclosure title="How is this order decided?">
      <div className="space-y-3">
        <p>Time comes first. Tasks starting within two hours or already due come first, then the rest of today, then anything from tomorrow on.</p>
        <p>Inside each group, the Priority Score decides. It is a number from 0 to 100 made from five things:</p>
        <ul className="space-y-1.5">
          {factors.map((f) => (
            <li key={f.label} className="flex items-baseline justify-between gap-3">
              <span>
                <span className="font-semibold text-ink">{f.label}</span>, {f.text}
              </span>
              <span className="font-semibold tabular-nums text-ink">{Math.round(f.weight * 100)}%</span>
            </li>
          ))}
        </ul>
        <p>When two scores are equal, the one due sooner goes first. Then the one more depends on, then the one that is harder to hand over, then the one that matters more, then the quicker one.</p>
      </div>
    </Disclosure>
  );
}

/** Everything after the "Do first" task, grouped by when to do it. */
export function RankedTaskList({ items, onToggle, pending }: { items: RankedTask[]; onToggle: (task: Task) => void; pending: boolean }) {
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.advice === g.advice);
        if (list.length === 0) return null;
        return (
          <section key={g.advice} aria-labelledby={`group-${g.advice}`}>
            <SectionHeader id={`group-${g.advice}`} title={g.title} count={list.length} />
            <p className="-mt-1 mb-3 text-sm text-ink-muted">{g.help}</p>
            <ol className="space-y-2.5">
              {list.map((item) => (
                <RankedRow key={item.task.id} item={item} onToggle={onToggle} pending={pending} />
              ))}
            </ol>
          </section>
        );
      })}
      <HowItIsDecided />
    </div>
  );
}
