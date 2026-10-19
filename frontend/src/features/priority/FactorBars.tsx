import { cn } from '@/lib/cn';
import type { CandidateScore, PriorityBreakdown } from '@/types/domain';

function FactorRow({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-3 text-[0.8125rem]">
      <span className="text-ink-muted">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
        <span className={cn('block h-full rounded-full', warning ? 'bg-red-300' : 'bg-primary-400')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('text-right font-semibold tabular-nums', warning && pct > 0 ? 'text-red-600' : 'text-ink')}>{pct}%</span>
    </li>
  );
}

/** What pushed a shared task up the Handovers list, in plain words. */
export function PriorityFactors({ priority }: { priority: PriorityBreakdown }) {
  const f = priority.factors;
  return (
    <ul aria-label="What counts towards the priority" className="space-y-2">
      <FactorRow label="Deadline" value={f.deadline} />
      <FactorRow label="How much it matters" value={f.criticality} />
      <FactorRow label="What depends on it" value={f.dependency} />
      <FactorRow label="How hard it is to hand over" value={f.reassignment} />
      <FactorRow label="Clash" value={f.conflict} warning />
    </ul>
  );
}

/** Why someone is, or is not, a good fit for a task, in plain words. */
export function SuitabilityFactors({ candidate }: { candidate: CandidateScore }) {
  const f = candidate.factors;
  return (
    <ul aria-label="What counts towards the match" className="space-y-2">
      <FactorRow label="Free at that time" value={f.availability} />
      <FactorRow label="Room in their day" value={f.workloadCapacity} />
      <FactorRow label="Right skills" value={f.skillEligibility} />
      <FactorRow label="Clash with their plans" value={f.conflictCost} warning />
    </ul>
  );
}
