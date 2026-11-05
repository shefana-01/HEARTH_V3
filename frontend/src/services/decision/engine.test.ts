import { describe, expect, it } from 'vitest';
import { buildSampleWorkspace } from '@/mocks/sampleWorkspace';
import { expandEvents } from '@/lib/recurrence';
import { detectConflicts, priorityScore, PRIORITY_WEIGHTS, rankTasks, scoreCandidates, SUITABILITY_WEIGHTS, type EngineData } from './engine';

const DAY = 86_400_000;

function sampleData(now: number): EngineData {
  const ws = buildSampleWorkspace();
  return {
    tasks: ws.tasks,
    appointments: ws.appointments,
    members: ws.members,
    unavailability: ws.unavailability,
    busy: expandEvents(ws.events, now - DAY, now + 45 * DAY),
    calendarOwners: [...new Set(ws.events.map((e) => e.memberId))],
    viewerId: 'm-afsara',
  };
}

describe('decision engine', () => {
  const now = Date.now();
  const data = sampleData(now);

  it('weights add up to one', () => {
    const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum(PRIORITY_WEIGHTS)).toBeCloseTo(1);
    expect(sum(SUITABILITY_WEIGHTS) - SUITABILITY_WEIGHTS.conflictCost * 2).toBeCloseTo(0.5);
  });

  it('scores every task between 0 and 100 with an explanation', () => {
    for (const task of data.tasks) {
      const p = priorityScore(task, data, undefined, now);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
      expect(p.explanation.length).toBeGreaterThan(0);
    }
  });

  it('finds a clash when two of one person’s tasks overlap', () => {
    const base = data.tasks.find((t) => t.assigneeId === 'm-rafid' && t.status === 'scheduled' && new Date(t.start).getTime() > now)!;
    const overlapping = { ...base, id: 'clash-test', title: 'Second thing at the same time', visibility: 'family' as const };
    const conflicts = detectConflicts({ ...data, tasks: [...data.tasks, overlapping] }, now);
    expect(conflicts.some((c) => c.taskId === 'clash-test' || c.taskId === base.id)).toBe(true);
  });

  it('never suggests an observer, and ranks candidates best first', () => {
    const task = data.tasks.find((t) => t.visibility === 'family' && t.status === 'scheduled')!;
    const candidates = scoreCandidates(task, data);
    const observers = data.members.filter((m) => m.role === 'observer').map((m) => m.id);
    expect(candidates.some((c) => observers.includes(c.memberId))).toBe(false);
    expect(candidates.map((c) => c.score)).toEqual([...candidates.map((c) => c.score)].sort((a, b) => b - a));
  });

  it('ranks my day from 1 with each task once', () => {
    const ranked = rankTasks('m-afsara', data, now);
    expect(ranked.map((r) => r.rank)).toEqual(ranked.map((_, i) => i + 1));
    expect(new Set(ranked.map((r) => r.task.id)).size).toBe(ranked.length);
  });
});
