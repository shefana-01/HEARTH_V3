import { cn } from '@/lib/cn';
import { PRIORITY_WEIGHTS, SUITABILITY_WEIGHTS } from '@/services/decision/decisionService';
import type { CandidateScore, PriorityBreakdown } from '@/types/domain';

function FactorRow({ label, value, weight, negative }: { label: string; value: number; weight: number; negative?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-3 text-[13px]">
      <span className="truncate text-ink-muted">
        {label} <span className="text-ink-subtle">× {weight}</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
        <span className={cn('block h-full rounded-full', negative ? 'bg-red-300' : 'bg-primary-400')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('text-right font-semibold tabular-nums', negative && value > 0 ? 'text-red-600' : 'text-ink')}>
        {negative && value > 0 ? '−' : ''}
        {pct}%
      </span>
    </div>
  );
}

/** Score pill used on candidate and task cards. */
export function ScorePill({ score, label }: { score: number; label: string }) {
  const tone = score >= 75 ? 'bg-mint-100 text-mint-800' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <span className={cn('inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', tone)} aria-label={`${label}: ${score} out of 100`}>
      {score}
      <span className="text-[10px] font-semibold opacity-70">/100</span>
    </span>
  );
}

/** Candidate Suitability Score breakdown. */
export function SuitabilityBreakdown({ candidate }: { candidate: CandidateScore }) {
  const w = SUITABILITY_WEIGHTS;
  return (
    <div className="space-y-2">
      <FactorRow label="Availability" value={candidate.factors.availability} weight={w.availability} />
      <FactorRow label="Workload capacity" value={candidate.factors.workloadCapacity} weight={w.workloadCapacity} />
      <FactorRow label="Skill eligibility" value={candidate.factors.skillEligibility} weight={w.skillEligibility} />
      <FactorRow label="Conflict cost" value={candidate.factors.conflictCost} weight={w.conflictCost} negative />
      <p className="pt-1 text-xs text-ink-subtle">Score = w₁·Availability + w₂·Workload + w₃·Skill − w₄·Conflict, scaled to 100.</p>
    </div>
  );
}

/** Task Priority Score breakdown. */
export function PriorityBreakdownView({ priority }: { priority: PriorityBreakdown }) {
  const w = PRIORITY_WEIGHTS;
  const f = priority.factors;
  return (
    <div className="space-y-2">
      <FactorRow label="Deadline urgency" value={f.deadline} weight={w.deadline} />
      <FactorRow label="Care criticality" value={f.criticality} weight={w.criticality} />
      <FactorRow label="Dependency impact" value={f.dependency} weight={w.dependency} />
      <FactorRow label="Reassignment difficulty" value={f.reassignment} weight={w.reassignment} />
      <FactorRow label="Conflict severity" value={f.conflict} weight={w.conflict} />
      <p className="pt-1 text-xs text-ink-subtle">P = w_D·D + w_C·C + w_I·I + w_R·R + w_S·S, scaled to 100.</p>
    </div>
  );
}
