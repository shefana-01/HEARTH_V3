import { useParams } from 'react-router-dom';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync } from '@/hooks/useAsync';
import type { CandidateScore } from '@/types/domain';

/** Load a reassignment request with its task and scored candidates. */
export function useRequest() {
  const { requestId = '' } = useParams();
  return useAsync(() => decisionService.getRequest(requestId), [requestId]);
}

export function riskOf(c: CandidateScore): { label: string; tone: 'mint' | 'amber' | 'red'; note: string } {
  if (c.factors.availability === 0) return { label: 'Unavailable', tone: 'red', note: 'Reported time away' };
  if (c.overlapMinutes > 0) return { label: 'Overlap', tone: 'red', note: `${c.overlapMinutes} min clash` };
  if (c.factors.availability < 1) return { label: 'Low risk', tone: 'amber', note: 'Outside usual hours' };
  return { label: 'None', tone: 'mint', note: 'No schedule overlap' };
}

export function fitLabel(c: CandidateScore, index: number): string {
  if (index === 0 && c.score >= 70) return 'Best fit';
  if (c.score >= 70) return 'Good fit';
  if (c.score >= 50) return 'Possible';
  return 'Not ideal';
}
