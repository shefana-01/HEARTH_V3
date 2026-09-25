import { useMemo, useState } from 'react';
import { CircleCheckBig, Clock, ListChecks, Plus, Search } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { taskService } from '@/services/tasks/taskService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { dayDiff, formatRelativeDay } from '@/lib/dates';
import { plural } from '@/lib/format';
import { ButtonLink, Callout, FabLink, EmptyState, ErrorState, Input, ListSkeleton, PageHeader, SectionHeader, SegmentedControl, Select, Tabs, TabPanel, useToast } from '@/components/ui';
import { TaskRow } from '@/components/domain/TaskRow';
import type { Task } from '@/types/domain';

type Filter = 'all' | 'today' | 'upcoming' | 'attention' | 'completed';
type Scope = 'mine' | 'family';
type Sort = 'suggested' | 'time' | 'priority';

const PRIORITY_RANK = { urgent: 0, important: 1, routine: 2 };
const endOf = (t: Task) => new Date(t.start).getTime() + t.durationMin * 60_000;

export default function TasksPage() {
  useDocumentTitle('Tasks');
  const { me } = useFamily();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [scope, setScope] = useState<Scope>('mine');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('time');

  const data = useAsync(() => Promise.all([taskService.listTasks(), decisionService.listAttention(), decisionService.getMyDay()]), []);
  const toggle = useMutation((t: Task) => (t.status === 'completed' ? taskService.reopenTask(t.id) : taskService.completeTask(t.id)));

  const [tasks = [], attention = [], myDay = []] = data.data ?? [];
  // Shared tasks come from the attention list; my private tasks only show up in my day.
  const conflictByTask = useMemo(() => {
    const map = new Map(attention.map((a) => [a.task.id, a.conflict]));
    myDay.forEach((r) => r.conflict && map.set(r.task.id, r.conflict));
    return map;
  }, [attention, myDay]);
  const rankByTask = useMemo(() => new Map(myDay.map((r) => [r.task.id, r.rank])), [myDay]);
  const activeSort: Sort = sort === 'suggested' && scope !== 'mine' ? 'time' : sort;

  const scoped = tasks.filter((t) => scope === 'family' || t.assigneeId === me?.id);
  const matchesQuery = (t: Task) => !query.trim() || `${t.title} ${t.notes}`.toLowerCase().includes(query.trim().toLowerCase());
  const buckets: Record<Filter, Task[]> = {
    all: scoped.filter((t) => t.status === 'scheduled'),
    today: scoped.filter((t) => t.status === 'scheduled' && dayDiff(t.start) === 0),
    upcoming: scoped.filter((t) => t.status === 'scheduled' && dayDiff(t.start) > 0),
    attention: scoped.filter((t) => conflictByTask.has(t.id)),
    completed: scoped.filter((t) => t.status === 'completed'),
  };
  const overdue = scoped.filter((t) => t.status === 'scheduled' && endOf(t) < Date.now() && !conflictByTask.has(t.id));

  const compare = (a: Task, b: Task): number => {
    if (filter === 'completed') return b.start.localeCompare(a.start);
    if (activeSort === 'suggested') return (rankByTask.get(a.id) ?? Infinity) - (rankByTask.get(b.id) ?? Infinity) || a.start.localeCompare(b.start);
    if (activeSort === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.start.localeCompare(b.start);
    return a.start.localeCompare(b.start);
  };
  const visible = buckets[filter].filter(matchesQuery).sort(compare);

  // Suggested order is one ranked list, so it is not split by day.
  const ranked = activeSort === 'suggested' && filter !== 'completed';
  const groups = visible.reduce<Map<string, Task[]>>((map, t) => {
    const key = ranked ? 'In suggested order' : formatRelativeDay(t.start);
    map.set(key, [...(map.get(key) ?? []), t]);
    return map;
  }, new Map());

  const onToggle = async (task: Task) => {
    const updated = await toggle.run(task);
    if (!updated) return toast({ tone: 'error', title: 'Couldn’t update the task', description: toggle.error ?? undefined });
    if (updated.status === 'completed') toast({ title: 'Marked as done', description: updated.title });
    data.reload();
  };

  const tabs = [
    { id: 'all' as const, label: 'Open', count: buckets.all.length },
    { id: 'today' as const, label: 'Today', count: buckets.today.length },
    { id: 'upcoming' as const, label: 'Upcoming', count: buckets.upcoming.length },
    { id: 'attention' as const, label: 'Needs sorting out', count: buckets.attention.length },
    { id: 'completed' as const, label: 'Completed', count: buckets.completed.length },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title={scope === 'mine' ? 'My tasks' : 'Family tasks'}
        description={data.data ? `${plural(buckets.today.length, 'task')} today${scope === 'mine' ? ' for you' : ' across the family'}.` : undefined}
        actions={
          <ButtonLink to="/tasks/new" className="hidden lg:inline-flex" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            New task
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <Input id="task-search" type="search" leftIcon={<Search />} placeholder="Search tasks or notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Whose tasks"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: 'Mine' },
              { value: 'family', label: 'Family' },
            ]}
          />
          <div className="w-48">
            <label htmlFor="task-sort" className="sr-only">
              Sort tasks
            </label>
            <Select id="task-sort" value={activeSort} onChange={(e) => setSort(e.target.value as Sort)}>
              {scope === 'mine' && <option value="suggested">Suggested order</option>}
              <option value="time">By time</option>
              <option value="priority">By priority label</option>
            </Select>
          </div>
        </div>
      </div>

      <Tabs label="Task filters" idPrefix="tasks" items={tabs} value={filter} onChange={setFilter} className="mb-6" />

      <TabPanel idPrefix="tasks" id={filter}>
        {data.status === 'error' ? (
          <ErrorState message={data.error?.message} onRetry={data.reload} />
        ) : !data.data ? (
          <ListSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={filter === 'completed' ? <CircleCheckBig aria-hidden="true" /> : <ListChecks aria-hidden="true" />}
            tone={filter === 'attention' ? 'mint' : 'primary'}
            title={
              query
                ? 'No tasks match your search'
                : filter === 'attention'
                  ? 'Nothing needs sorting out'
                  : filter === 'completed'
                    ? 'No completed tasks yet'
                    : scope === 'mine'
                      ? 'You have no tasks here'
                      : 'No tasks here yet'
            }
            description={
              query ? 'Try a different word, or clear the search.' : filter === 'attention' ? 'Every task has someone free to do it.' : 'Tasks you add, or that are given to you, will appear here.'
            }
            action={!query && filter !== 'completed' && filter !== 'attention' ? <ButtonLink to="/tasks/new">Create a task</ButtonLink> : undefined}
          />
        ) : (
          <div className="space-y-8">
            {[...groups.entries()].map(([day, list]) => (
              <section key={day} aria-label={day}>
                <SectionHeader title={day} as="h2" aside={plural(list.length, 'task')} />
                <ul className="space-y-2.5">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} conflict={conflictByTask.get(t.id)} onToggle={onToggle} pending={toggle.pending} showDay={ranked} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </TabPanel>

      {data.data && (
        <Callout
          className="mt-8"
          tone={overdue.length ? 'amber' : 'mint'}
          icon={<Clock aria-hidden="true" />}
          title={overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} past due` : 'Nothing is overdue.'}
        >
          {overdue.length ? 'Mark them done if they happened, or move them to a new time.' : `${plural(buckets.completed.length, 'task')} done so far.`}
        </Callout>
      )}
      <FabLink to="/tasks/new" icon={<Plus />}>
        Add task
      </FabLink>
    </>
  );
}
