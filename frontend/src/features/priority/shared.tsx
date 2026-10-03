import { useParams } from 'react-router-dom';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync } from '@/hooks/useAsync';
import type { CandidateScore, Conflict } from '@/types/domain';

/** Load a handover request with its task and scored candidates. */
export function useRequest() {
  const { requestId = '' } = useParams();
  return useAsync(() => decisionService.getRequest(requestId), [requestId]);
}

/** Short plain-words name for why a shared task cannot go ahead as planned. */
export const CONFLICT_LABELS: Record<Conflict['kind'], string> = {
  unassigned: 'Needs someone',
  overlap: 'Clash',
  'outside-availability': 'Outside their usual hours',
  'reported-unavailable': 'Can’t make it',
};

export function riskOf(c: CandidateScore): { label: string; tone: 'mint' | 'amber' | 'red'; note: string } {
  if (c.factors.availability === 0) return { label: 'Away', tone: 'red', note: 'Said they can’t make it' };
  if (c.overlapMinutes > 0) return { label: 'Clash', tone: 'red', note: `${c.overlapMinutes} min clash` };
  if (c.factors.availability < 1) return { label: 'Small risk', tone: 'amber', note: 'Outside their usual hours' };
  return { label: 'None', tone: 'mint', note: 'No clash' };
}

export function fitLabel(c: CandidateScore, index: number): string {
  if (index === 0 && c.score >= 70) return 'Best fit';
  if (c.score >= 70) return 'Good fit';
  if (c.score >= 50) return 'Possible';
  return 'Not ideal';
}
