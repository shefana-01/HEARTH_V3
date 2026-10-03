import { Check } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import type { CandidateScore } from '@/types/domain';

/** Choose who does a shared task, with how well each person fits the chosen time. "Me" comes first. */
export function AssigneePicker({ value, onChange, scores }: { value: string | null; onChange: (memberId: string | null) => void; scores: CandidateScore[] }) {
  const { members, me } = useFamily();
  const helpers = members.filter((m) => m.status === 'active' && m.role !== 'observer').sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id));

  return (
    <fieldset>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <legend className="text-sm font-semibold text-ink">Who is free?</legend>
        <span className="text-xs text-ink-subtle">Scores show how well each person fits this time</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Who will do it">
        {helpers.map((m) => {
          const active = value === m.id;
          const score = scores.find((s) => s.memberId === m.id);
          const isMe = m.id === me?.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m.id)}
              className={cn(
                'relative flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors',
                active ? 'border-mint-400 bg-mint-50' : 'border-line hover:border-primary-300',
              )}
            >
              {active && <Check aria-hidden="true" className="absolute right-2 top-2 h-4 w-4 text-mint-600" strokeWidth={3} />}
              <Avatar name={m.name} seed={m.id} />
              <span className="text-sm font-semibold text-ink">{isMe ? 'Me' : m.name.split(' ')[0]}</span>
              <span className="text-xs text-ink-subtle">{isMe ? m.name.split(' ')[0] : m.relation || 'Member'}</span>
              {score && <ScorePill score={score.score} label={`${isMe ? 'My' : m.name} fit for this time`} />}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={cn(
            'flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-3 text-center text-sm font-semibold',
            value === null ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line-strong text-ink-muted hover:border-primary-300',
          )}
        >
          Decide later
          <span className="text-xs font-normal text-ink-subtle">Needs someone</span>
        </button>
      </div>
    </fieldset>
  );
}
