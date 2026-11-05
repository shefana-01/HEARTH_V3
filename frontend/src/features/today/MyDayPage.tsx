import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, CalendarX2, ListChecks, Plus, Sparkles, Sun, Wand2 } from 'lucide-react';
import { QuickAddDialog } from '@/features/ai/QuickAddDialog';
import { useFamily } from '@/app/FamilyProvider';
import { useTranslation } from '@/i18n';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { dayDiff, formatLongDate, formatTime, greeting } from '@/lib/dates';
import { plural } from '@/lib/format';
import { Button, ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader, ProgressBar, useToast } from '@/components/ui';
import type { RankedTask, Task } from '@/types/domain';
import { DoFirstCard } from './DoFirstCard';
import { RankedTaskList } from './RankedTaskList';
import { FamilyCard, FoodCard, ScheduleCard } from './SideCards';
import { StatusLine } from './StatusLine';
import { MedicinesCard } from './MedicinesCard';

/** "3 things left today. Next: Submit lab report at 4:00 PM." */
function summarise(ranked: RankedTask[] | undefined): string | undefined {
  if (!ranked) return undefined;
  const today = ranked.filter((r) => dayDiff(r.task.start) <= 0);
  if (today.length === 0) return 'Nothing left for today.';
  const next = today[0].task;
  return `${plural(today.length, 'thing')} left today. Next: ${next.title} at ${formatTime(next.start)}.`;
}

export default function MyDayPage() {
  const { t, language } = useTranslation();
  useDocumentTitle(t.nav.today);
  const { me } = useFamily();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quickAdd, setQuickAdd] = useState(false);

  const day = useAsync(() => Promise.all([decisionService.getMyDay(), taskService.listTasks({ assigneeId: me?.id })]), [me?.id]);

  useLiveRefresh(['tasks', 'plan', 'family'], day.reload);
  const complete = useMutation(taskService.completeTask);
  const ask = useMutation(decisionService.requestReassignment);

  const [ranked = [], mine = []] = day.data ?? [];
  const [first, ...rest] = ranked;
  const todays = mine.filter((t) => t.assigneeId === me?.id && dayDiff(t.start) === 0);
  const doneToday = todays.filter((t) => t.status === 'completed').length;

  const markDone = async (task: Task) => {
    const done = await complete.run(task.id);
    if (!done) {
      toast({ tone: 'error', title: 'Couldn’t mark it as done', description: complete.error ?? undefined });
      return;
    }
    toast({ title: 'Marked as done', description: task.title });
    await day.reload();
  };

  const askSomeone = async (item: RankedTask) => {
    const reason = item.conflict?.reason ?? `${me?.name.split(' ')[0] ?? 'Someone'} asked for someone else to take this task.`;
    const request = await ask.run(item.task.id, reason);
    if (request) navigate(`/priority/requests/${request.id}`);
    else toast({ tone: 'error', title: 'Couldn’t ask for a handover', description: ask.error ?? undefined });
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Sun aria-hidden="true" className="h-3.5 w-3.5" />
            {formatLongDate(new Date())}
          </span>
        }
        title={`${greeting()}, ${me?.name.split(' ')[0] ?? 'there'}`}
        description={summarise(day.data?.[0])}
        actions={
          <>
            <ButtonLink to="/tasks/new" className="min-h-11" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
              {t.tasks.newTask}
            </ButtonLink>
            <Button variant="secondary" className="min-h-11" onClick={() => setQuickAdd(true)} leftIcon={<Wand2 aria-hidden="true" className="h-4 w-4" />}>
              Quick add
            </Button>
            <ButtonLink to="/plan" variant="soft" className="min-h-11" leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />}>
              Plan my week
            </ButtonLink>
            <ButtonLink to="/schedule/events/new" variant="secondary" className="min-h-11" leftIcon={<CalendarPlus aria-hidden="true" className="h-4 w-4" />}>
              {t.common.addToSchedule}
            </ButtonLink>
            <ButtonLink to="/schedule/unavailable" variant="soft" className="min-h-11" leftIcon={<CalendarX2 aria-hidden="true" className="h-4 w-4" />}>
              {t.common.cantMakeIt}
            </ButtonLink>
          </>
        }
      />

      <QuickAddDialog open={quickAdd} onClose={() => setQuickAdd(false)} onSaved={() => void day.reload()} />

      <StatusLine />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          {todays.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">
                {language === 'bn' ? `${t.common.doneToday}: ${doneToday} / ${todays.length}` : `${t.common.doneToday}: ${doneToday} of ${todays.length}`}
              </p>
              <ProgressBar value={doneToday} max={todays.length} tone="mint" label="Tasks done today" />
            </div>
          )}
          {day.status === 'error' ? (
            <ErrorState message={day.error?.message} onRetry={day.reload} />
          ) : !day.data ? (
            <ListSkeleton rows={4} />
          ) : !first ? (
            <EmptyState
              icon={<ListChecks aria-hidden="true" />}
              tone="mint"
              title={t.common.nothingTodo}
              description={t.common.nothingTodoDesc}
              action={
                <ButtonLink to="/tasks/new" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
                  {t.common.createTask}
                </ButtonLink>
              }
            />
          ) : (
            <>
              <DoFirstCard item={first} onDone={() => void markDone(first.task)} onAsk={() => void askSomeone(first)} donePending={complete.pending} askPending={ask.pending} />
              <RankedTaskList items={rest} onToggle={(t) => void markDone(t)} pending={complete.pending} />
            </>
          )}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Today at a glance">
          <MedicinesCard />
          <ScheduleCard />
          <FoodCard />
          <FamilyCard />
        </aside>
      </div>
    </>
  );
}
