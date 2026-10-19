import { cn } from '@/lib/cn';
import { PRIORITY_WEIGHTS, SUITABILITY_WEIGHTS } from '@/services/decision/decisionService';
import type { CandidateScore, PriorityBreakdown } from '@/types/domain';

function FactorRow({ label, value, weight, negative }: { label: string; value: number; weight: number; negative?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-3 text-[0.8125rem]">
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

const MATCH_TONES = { high: 'bg-mint-100 text-mint-800', mid: 'bg-amber-100 text-amber-700', low: 'bg-red-100 text-red-700' };
const PRIORITY_TONES = { high: 'bg-red-100 text-red-700', mid: 'bg-amber-100 text-amber-700', low: 'bg-surface-sunken text-ink-muted' };

/**
 * Score pill used on candidate and task cards.
 * `match` (how well a person fits a task): high is good, so high is green.
 * `priority` (how pressing a task is): high needs attention, low is calm.
 */
export function ScorePill({ score, label, kind = 'match' }: { score: number; label: string; kind?: 'match' | 'priority' }) {
  const tone = kind === 'priority' ? PRIORITY_TONES[score >= 70 ? 'high' : score >= 45 ? 'mid' : 'low'] : MATCH_TONES[score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low'];
  return (
    <span className={cn('inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', tone)} aria-label={`${label}: ${score} out of 100`}>
      {score}
      <span className="text-[0.625rem] font-semibold opacity-70">/100</span>
    </span>
  );
}

/** Candidate Suitability Score breakdown. */
export function SuitabilityBreakdown({ candidate }: { candidate: CandidateScore }) {
  const w = SUITABILITY_WEIGHTS;
  return (
    <div className="space-y-2">
      <FactorRow label="Free at that time" value={candidate.factors.availability} weight={w.availability} />
      <FactorRow label="Room in their day" value={candidate.factors.workloadCapacity} weight={w.workloadCapacity} />
      <FactorRow label="Can do this kind of task" value={candidate.factors.skillEligibility} weight={w.skillEligibility} />
      <FactorRow label="Clashes with their plans" value={candidate.factors.conflictCost} weight={w.conflictCost} negative />
      <p className="pt-1 text-xs text-ink-subtle">The first three add to the score and a clash takes away from it. The result is scaled to 100.</p>
    </div>
  );
}

/** Task Priority Score breakdown. */
export function PriorityBreakdownView({ priority }: { priority: PriorityBreakdown }) {
  const w = PRIORITY_WEIGHTS;
  const f = priority.factors;
  return (
    <div className="space-y-2">
      <FactorRow label="Deadline" value={f.deadline} weight={w.deadline} />
      <FactorRow label="How much it matters" value={f.criticality} weight={w.criticality} />
      <FactorRow label="What depends on it" value={f.dependency} weight={w.dependency} />
      <FactorRow label="How hard it is to hand over" value={f.reassignment} weight={w.reassignment} />
      <FactorRow label="Clash" value={f.conflict} weight={w.conflict} />
      <p className="pt-1 text-xs text-ink-subtle">Each part is between 0 and 1. They are multiplied by their weights, added up and scaled to 100.</p>
    </div>
  );
}
