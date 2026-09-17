import { useSearchParams } from 'react-router-dom';
import type { SimulationChange } from '@/types/domain';

/**
 * The simulated change lives in the URL (?task=…&assignee=…&start=…) so a
 * simulation can be refreshed, shared, or opened from the impact page.
 * `assignee=none` means "unassigned"; a missing param means "unchanged".
 */
export function useSimulationParams() {
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task') ?? '';
  const assigneeParam = params.get('assignee');
  const start = params.get('start') ?? undefined;

  const change: SimulationChange | null = taskId
    ? {
        taskId,
        ...(assigneeParam !== null ? { assigneeId: assigneeParam === 'none' ? null : assigneeParam } : {}),
        ...(start ? { start } : {}),
      }
    : null;

  const update = (next: { task?: string; assignee?: string | null; start?: string | null }) => {
    const p = new URLSearchParams(params);
    if (next.task !== undefined) {
      p.set('task', next.task);
      p.delete('assignee');
      p.delete('start');
    }
    if (next.assignee !== undefined) {
      if (next.assignee === null) p.delete('assignee');
      else p.set('assignee', next.assignee);
    }
    if (next.start !== undefined) {
      if (next.start === null) p.delete('start');
      else p.set('start', next.start);
    }
    setParams(p, { replace: true });
  };

  const query = params.toString();
  return { change, update, query, hasChange: Boolean(change && (assigneeParam !== null || start)) };
}
