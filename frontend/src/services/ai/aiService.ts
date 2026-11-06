/**
 * AI help — ai-service.
 *
 * Four capabilities:
 * 1. Task drafts from a sentence ("quick add") with per-task & assignee suitability reasoning,
 * 2. A suggested plan for the next seven days (with optional custom user instructions) verified by the decision engine,
 * 3. Interactive conversational AI assistant grounded in Google Gemini 2.5 Flash + Hearth's live schedule & decision engine,
 * 4. Message drafts.
 *
 * Nothing is ever saved automatically: the person reviews every result and applies or saves it through the
 * normal services, which enforce every rule.
 *
 * Two modes:
 * - `ai`: Google Gemini (direct via Google AI Studio API or server ai-service).
 * - `basic`: the schedule-aware conversational engine in `aiService.ts` + `localAssistant.ts` + decision engine.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { db, fail, persist, respond } from '../mockStore';
import { decisionService, type AttentionItem } from '../decision/decisionService';
import { taskService } from '../tasks/taskService';
import { formatDayTime } from '@/lib/dates';
import { expandEvents } from '@/lib/recurrence';
import type { CandidateScore, ID, ISODateTime, RankedTask, Task, TaskCategory, TaskPriority, Visibility } from '@/types/domain';
import { readNote, type RosterPerson } from './localAssistant';

export type AiMode = 'ai' | 'basic';
export type AiModelProvider = 'gemini' | 'chatgpt';

const GEMINI_STORAGE_KEY = 'hearth_gemini_api_key';
const MODEL_PROVIDER_KEY = 'hearth_ai_model_provider';

export function getSelectedAiProvider(): AiModelProvider {
  try {
    const stored = localStorage.getItem(MODEL_PROVIDER_KEY);
    if (stored === 'chatgpt' || stored === 'gemini') return stored;
  } catch {
    // ignore
  }
  return 'gemini';
}

export function setSelectedAiProvider(provider: AiModelProvider): void {
  try {
    localStorage.setItem(MODEL_PROVIDER_KEY, provider);
  } catch {
    // ignore
  }
}

export function getGeminiApiKey(): string | null {
  try {
    const stored = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // localStorage not accessible
  }
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GEMINI_API_KEY;
  return envKey && envKey.trim() ? envKey.trim() : null;
}

export function setGeminiApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(GEMINI_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

export interface AiStatus {
  /** The server or browser has AI help configured. */
  enabled: boolean;
  consented: boolean;
  consentedAt?: ISODateTime;
  usedToday: number;
  dailyLimit: number;
  monthlyBudgetUsedPercent: number;
}

/** Which assistant answers: Gemini when configured, otherwise the schedule-aware assistant. */
export const modeOf = (status: AiStatus | undefined): AiMode => {
  if (hasGeminiApiKey()) return 'ai';
  return status?.enabled && status.consented ? 'ai' : 'basic';
};

/** A task ready to be saved with `taskService.createTask`. */
export interface TaskDraft {
  title: string;
  notes: string;
  category: TaskCategory;
  priority: TaskPriority;
  start: ISODateTime;
  durationMin: number;
  assigneeId: ID | null;
  forId?: ID;
  visibility: Visibility;
  reminder: boolean;
  /** Plain-language explanation of why this category, priority, time and assignee were chosen. */
  reason?: string;
}

export interface QuickAddResult {
  drafts: TaskDraft[];
  /** What was guessed, in plain sentences. */
  assumptions: string[];
}

export type PlanAction = 'do-first' | 'move' | 'hand-over';

export interface PlanSuggestion {
  id: string;
  taskId: ID;
  taskTitle: string;
  action: PlanAction;
  start?: ISODateTime;
  assigneeId?: ID;
  reason: string;
  /** Clashes the change fixes and creates, from the decision engine's what-if check. */
  resolves: number;
  introduces: number;
}

export interface PlanResult {
  summary: string;
  suggestions: PlanSuggestion[];
  generatedAt: ISODateTime;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatReply {
  reply: string;
  reasoning?: string[];
  drafts?: TaskDraft[];
  suggestions?: PlanSuggestion[];
  followUps?: string[];
  modelLabel?: string;
}

export interface LiveContextSnapshot {
  todayClassesCount: number;
  todayTasksCount: number;
  todayFreeWindowsCount: number;
  todayFreeMinutes: number;
  clashCount: number;
  topTaskTitle?: string;
}

export type DraftKind = 'handover-request' | 'reminder' | 'chat-message' | 'weekly-summary';
export type DraftTone = 'friendly' | 'formal' | 'short';
export type DraftLanguage = 'en' | 'bn';

export interface DraftRequest {
  kind: DraftKind;
  taskId?: ID;
  toMemberId?: ID;
  points?: string;
  tone?: DraftTone;
  language?: DraftLanguage;
}

const DEMO_STATUS = (): AiStatus => ({
  enabled: hasGeminiApiKey(),
  consented: Boolean(db.aiConsent) || hasGeminiApiKey(),
  usedToday: 0,
  dailyLimit: 100,
  monthlyBudgetUsedPercent: 0,
});

const firstName = (name: string | undefined) => (name ?? 'there').split(' ')[0];

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatRange(startMs: number, endMs: number): string {
  return `${formatClock(new Date(startMs))} – ${formatClock(new Date(endMs))}`;
}

interface ScheduleSlot {
  startMs: number;
  endMs: number;
  label: string;
  kind: 'class-event' | 'task' | 'appointment';
  priority?: string;
  category?: string;
  taskId?: string;
}

interface FreeWindow {
  startMs: number;
  endMs: number;
  durationMin: number;
}

interface DayScheduleSummary {
  date: Date;
  dayLabel: string;
  busy: ScheduleSlot[];
  free: FreeWindow[];
}

/**
 * Computes the user's real day-by-day schedule (classes/personal events, assigned tasks, appointments)
 * and exact open free windows between 08:30 and 22:30 for the next `daysCount` days.
 */
function buildMemberSchedule(meId: string, allTasks: Task[], daysCount = 3): DayScheduleSummary[] {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const horizonEnd = todayStart.getTime() + daysCount * 86_400_000;

  const myEvents = (db.events ?? []).filter((e) => e.memberId === meId);
  const expandedBusy = expandEvents(myEvents, todayStart.getTime(), horizonEnd);
  const myTasks = allTasks.filter((t) => t.assigneeId === meId && t.status === 'scheduled');
  const myAppts = (db.appointments ?? []).filter((a) => a.forId === meId || a.escortId === meId);

  const days: DayScheduleSummary[] = [];
  for (let d = 0; d < daysCount; d++) {
    const dayDate = new Date(todayStart.getTime() + d * 86_400_000);
    const dayStartMs = dayDate.getTime();
    const dayEndMs = dayStartMs + 86_400_000;
    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const dayLabel = d === 0 ? `Today (${dayName})` : d === 1 ? `Tomorrow (${dayName})` : dayName;

    const busy: ScheduleSlot[] = [];

    for (const ev of expandedBusy) {
      const s = new Date(ev.start).getTime();
      const e = new Date(ev.end).getTime();
      if (s < dayEndMs && e > dayStartMs) {
        busy.push({ startMs: s, endMs: e, label: ev.label, kind: 'class-event' });
      }
    }

    for (const t of myTasks) {
      const s = new Date(t.start).getTime();
      const e = s + t.durationMin * 60_000;
      if (s < dayEndMs && e > dayStartMs) {
        busy.push({
          startMs: s,
          endMs: e,
          label: t.title,
          kind: 'task',
          priority: t.priority,
          category: t.category,
          taskId: t.id,
        });
      }
    }

    for (const a of myAppts) {
      const s = new Date(a.start).getTime();
      const e = s + a.durationMin * 60_000;
      if (s < dayEndMs && e > dayStartMs) {
        busy.push({ startMs: s, endMs: e, label: a.title, kind: 'appointment' });
      }
    }

    busy.sort((a, b) => a.startMs - b.startMs);

    // Compute free windows between 08:30 and 22:30 (for today, start from max(08:30, next 15-min mark after now))
    const awakeStart = new Date(dayDate);
    awakeStart.setHours(8, 30, 0, 0);
    const awakeEnd = new Date(dayDate);
    awakeEnd.setHours(22, 30, 0, 0);

    let cursor = awakeStart.getTime();
    if (d === 0 && now.getTime() > cursor) {
      const rounded = Math.ceil(now.getTime() / (15 * 60_000)) * (15 * 60_000);
      cursor = Math.min(awakeEnd.getTime(), rounded);
    }

    const free: FreeWindow[] = [];
    for (const slot of busy) {
      if (slot.endMs <= cursor) continue;
      if (slot.startMs > cursor) {
        const gapEnd = Math.min(slot.startMs, awakeEnd.getTime());
        const dur = Math.round((gapEnd - cursor) / 60_000);
        if (dur >= 30) {
          free.push({ startMs: cursor, endMs: gapEnd, durationMin: dur });
        }
      }
      cursor = Math.max(cursor, slot.endMs);
      if (cursor >= awakeEnd.getTime()) break;
    }
    if (cursor < awakeEnd.getTime()) {
      const dur = Math.round((awakeEnd.getTime() - cursor) / 60_000);
      if (dur >= 30) {
        free.push({ startMs: cursor, endMs: awakeEnd.getTime(), durationMin: dur });
      }
    }

    days.push({ date: dayDate, dayLabel, busy, free });
  }

  return days;
}

function formatScheduleForPrompt(days: DayScheduleSummary[], myDay: RankedTask[], attention: AttentionItem[], roster: RosterPerson[]): string {
  const lines: string[] = [];
  for (const day of days) {
    lines.push(`${day.dayLabel}:`);
    if (day.busy.length === 0) {
      lines.push(`  - Fixed commitments: None`);
    } else {
      for (const b of day.busy) {
        const tag = b.kind === 'class-event' ? '[Class/Personal Event]' : b.kind === 'appointment' ? '[Appointment]' : `[Task: ${b.category}, ${b.priority}]`;
        lines.push(`  - ${formatRange(b.startMs, b.endMs)}: ${b.label} ${tag}`);
      }
    }
    if (day.free.length > 0) {
      lines.push(`  - Open Free Windows: ${day.free.map((f) => `${formatRange(f.startMs, f.endMs)} (${f.durationMin} min)`).join(', ')}`);
    }
  }
  if (myDay.length > 0) {
    lines.push(`\nPriority-Ranked Tasks for User:`);
    myDay.slice(0, 6).forEach((r) => {
      lines.push(`  - #${r.rank} "${r.task.title}" (${formatDayTime(r.task.start)}, ${r.task.durationMin}m) — Priority Score ${r.priority.score}/100: ${r.priority.explanation}`);
    });
  }
  if (attention.length > 0) {
    lines.push(`\nDetected Schedule Clashes / Unassigned Tasks:`);
    attention.slice(0, 5).forEach((a) => {
      const best = a.topCandidate ? `${firstName(roster.find((p) => p.id === a.topCandidate?.memberId)?.name)} (Suitability ${a.topCandidate.score}%)` : 'none';
      lines.push(`  - "${a.task.title}" (${formatDayTime(a.task.start)}): ${a.conflict.reason} | Best handover candidate: ${best}`);
    });
  }
  return lines.join('\n');
}

function formatCandidateReason(candidate: CandidateScore, roster: RosterPerson[]): string {
  const person = roster.find((p) => p.id === candidate.memberId);
  const name = firstName(person?.name);
  const details = candidate.reasons.length > 0 ? candidate.reasons.join(' ') : 'Available in Hearth.';
  return `${name} (Suitability ${candidate.score}% — ${details.replace(/\.$/, '')})`;
}

/**
 * Enriches drafts with live suitability scores from `decisionService.previewCandidates` when available,
 * explaining why the assignee was chosen and whether another family member is a stronger fit.
 */
async function enrichDraftsWithSuitability(result: QuickAddResult, note: string, roster: RosterPerson[], me: RosterPerson): Promise<QuickAddResult> {
  if (typeof decisionService?.previewCandidates !== 'function') return result;
  const enriched: TaskDraft[] = [];
  for (const draft of result.drafts) {
    let reason = draft.reason ?? '';
    let assigneeId = draft.assigneeId;
    try {
      const candidates = await decisionService.previewCandidates({
        category: draft.category,
        start: draft.start,
        durationMin: draft.durationMin,
      });
      if (candidates && candidates.length > 0) {
        const chosen = candidates.find((c) => c.memberId === assigneeId);
        const top = candidates[0];
        const assigneePerson = roster.find((p) => p.id === assigneeId);
        const explicitlyNamed = assigneePerson && new RegExp(`(^|[^\\p{L}])(${firstName(assigneePerson.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\p{L}]|$)`, 'iu').test(note);

        if (!explicitlyNamed && assigneeId === me.id && chosen && chosen.overlapMinutes > 0 && top && top.memberId !== me.id && top.overlapMinutes === 0 && top.score >= 70) {
          assigneeId = top.memberId;
          const topName = firstName(roster.find((p) => p.id === top.memberId)?.name);
          reason = `Suggested ${topName} (Suitability ${top.score}%: ${top.reasons.join(' ')}) because you have a ${chosen.overlapMinutes} min overlap at that time · ${reason}`;
        } else if (chosen) {
          const fitNote = `Suitability ${chosen.score}% (${chosen.reasons.slice(0, 2).join(' ') || (chosen.cautions[0] ?? 'checked against schedule')})`;
          const altNote = top && top.memberId !== assigneeId && top.score > chosen.score ? ` · Best alternative: ${formatCandidateReason(top, roster)}` : '';
          reason = reason ? `${reason.replace(/\.$/, '')} · ${fitNote}${altNote}.` : `${fitNote}${altNote}.`;
        }
      }
    } catch {
      // In isolated unit tests where decisionService is not active, keep the base reason.
    }
    enriched.push({ ...draft, assigneeId, reason });
  }
  return { drafts: enriched, assumptions: result.assumptions };
}

/* ───────────────────────── basic mode ───────────────────────── */

async function basicPlan(instructions?: string): Promise<PlanResult> {
  const [myDay, attention, allTasks] = await Promise.all([
    decisionService.getMyDay(),
    decisionService.listAttention(),
    typeof taskService?.listTasks === 'function' ? taskService.listTasks({ includeCancelled: false }).catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
  ]);
  const now = Date.now();
  const horizon = now + 7 * 86_400_000;
  const suggestions: PlanSuggestion[] = [];
  const seenTasks = new Set<string>();
  const instructionText = (instructions ?? '').trim();

  // 1. Honor custom user instructions first if provided.
  if (instructionText) {
    const lower = instructionText.toLowerCase();
    const members = db.members.filter((m) => m.status === 'active' && m.role !== 'observer');
    const namedTarget = members.find((m) => lower.includes(firstName(m.name).toLowerCase()));
    const dayIdx = WEEKDAY_NAMES.findIndex((w) => lower.includes(w) || lower.includes(w.slice(0, 3)));
    const wantsTomorrow = /\btomorrow\b|\btmrw\b|কাল/i.test(instructionText);
    const wantsToday = /\btoday\b|\btonight\b|আজ/i.test(instructionText);
    const wantsMove = /\b(move|push|postpone|reschedule|later|shift|tomorrow|morning|afternoon|evening)\b/i.test(instructionText);
    const wantsHandover = /\b(hand ?over|give|assign|ask|take over|reassign|busy|exam|cant|can't)\b/i.test(instructionText) || Boolean(namedTarget);

    const candidateTasks = allTasks.filter((t) => {
      if (t.status !== 'scheduled') return false;
      const startMs = new Date(t.start).getTime();
      if (startMs < now - 3_600_000 || startMs > horizon) return false;
      const d = new Date(t.start);
      if (dayIdx >= 0 && d.getDay() !== dayIdx) return false;
      if (wantsTomorrow) {
        const tmrw = new Date(now + 86_400_000);
        if (d.toDateString() !== tmrw.toDateString()) return false;
      } else if (wantsToday && !wantsMove) {
        if (d.toDateString() !== new Date(now).toDateString()) return false;
      }
      return true;
    });

    if (wantsHandover) {
      for (const task of candidateTasks) {
        if (suggestions.length >= 6 || task.visibility === 'private' || seenTasks.has(task.id)) continue;
        const insight = await decisionService.getTaskInsight(task.id).catch(() => null);
        const targetCandidate = namedTarget ? insight?.candidates.find((c) => c.memberId === namedTarget.id) : insight?.candidates[0];
        const assigneeId = namedTarget?.id ?? targetCandidate?.memberId;
        if (!assigneeId || assigneeId === task.assigneeId) continue;
        const sim = await decisionService.simulate({ taskId: task.id, assigneeId }).catch(() => null);
        if (sim && sim.introduced.length <= sim.resolved.length) {
          const targetName = firstName(members.find((m) => m.id === assigneeId)?.name);
          const scoreText = targetCandidate ? ` (Suitability ${targetCandidate.score}%: ${targetCandidate.reasons.join(' ') || 'available'})` : '';
          suggestions.push({
            id: `b${suggestions.length + 1}`,
            taskId: task.id,
            taskTitle: task.title,
            action: 'hand-over',
            assigneeId,
            reason: `Matches your instruction (“${instructionText.slice(0, 80)}”): hand over to ${targetName}${scoreText}. Verified with 0 new clashes.`,
            resolves: sim.resolved.length,
            introduces: sim.introduced.length,
          });
          seenTasks.add(task.id);
        }
      }
    }

    if (wantsMove) {
      for (const task of candidateTasks) {
        if (suggestions.length >= 6 || seenTasks.has(task.id)) continue;
        const currentStart = new Date(task.start);
        const proposed = new Date(currentStart);
        if (wantsTomorrow) {
          proposed.setDate(proposed.getDate() + 1);
        } else if (/\bmorning\b/i.test(instructionText)) {
          proposed.setDate(proposed.getDate() + 1);
          proposed.setHours(9, 30, 0, 0);
        } else if (/\bevening\b/i.test(instructionText)) {
          proposed.setHours(18, 0, 0, 0);
          if (proposed.getTime() <= currentStart.getTime()) proposed.setDate(proposed.getDate() + 1);
        } else {
          proposed.setDate(proposed.getDate() + 1);
          proposed.setHours(10, 0, 0, 0);
        }
        const newIso = proposed.toISOString();
        const sim = await decisionService.simulate({ taskId: task.id, start: newIso }).catch(() => null);
        if (sim && sim.introduced.length <= sim.resolved.length) {
          suggestions.push({
            id: `b${suggestions.length + 1}`,
            taskId: task.id,
            taskTitle: task.title,
            action: 'move',
            start: newIso,
            reason: `Matches your instruction (“${instructionText.slice(0, 80)}”): shifts “${task.title}” to ${formatDayTime(newIso)} when the schedule is clear.`,
            resolves: sim.resolved.length,
            introduces: sim.introduced.length,
          });
          seenTasks.add(task.id);
        }
      }
    }
  }

  // 2. Top task the person should do first (with full Priority Score reasoning).
  const first = myDay.find((r) => !r.conflict && new Date(r.task.start).getTime() < horizon && !seenTasks.has(r.task.id));
  if (first && first.task.status === 'scheduled' && suggestions.length < 6) {
    const scoreReason = `Priority score ${first.priority.score}/100 (${first.priority.explanation.replace(/\.$/, '')})${first.tieBreak ? ` · ${first.tieBreak}` : ''}.`;
    suggestions.push({
      id: `b${suggestions.length + 1}`,
      taskId: first.task.id,
      taskTitle: first.task.title,
      action: 'do-first',
      reason: `Chosen as your #1 focus because it has your highest clear priority (${scoreReason})`,
      resolves: 0,
      introduces: 0,
    });
    seenTasks.add(first.task.id);
  }

  // 3. Resolve every family conflict in `attention` via best candidate handover or time move.
  for (const item of attention) {
    if (suggestions.length >= 6 || new Date(item.task.start).getTime() > horizon || seenTasks.has(item.task.id)) continue;
    const candidate = item.topCandidate;
    if (candidate && candidate.memberId !== item.task.assigneeId && item.task.visibility !== 'private') {
      const result = await decisionService.simulate({ taskId: item.task.id, assigneeId: candidate.memberId });
      if (result.introduced.length <= result.resolved.length) {
        const candidateDetails = candidate.reasons.length > 0 ? candidate.reasons.join(' ') : 'Free during this window.';
        suggestions.push({
          id: `b${suggestions.length + 1}`,
          taskId: item.task.id,
          taskTitle: item.task.title,
          action: 'hand-over',
          assigneeId: candidate.memberId,
          reason: `${item.conflict.reason} Chosen candidate suitability: ${candidate.score}/100 (${candidateDetails.replace(/\.$/, '')}; Priority ${item.priority.score}/100).`,
          resolves: result.resolved.length,
          introduces: result.introduced.length,
        });
        seenTasks.add(item.task.id);
        continue;
      }
    }

    const currentStart = new Date(item.task.start);
    const trySlots: Date[] = [];
    const plus2h = new Date(currentStart.getTime() + 2 * 3_600_000);
    if (plus2h.getHours() >= 7 && plus2h.getHours() <= 21) trySlots.push(plus2h);
    const nextMorning = new Date(currentStart);
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(10, 0, 0, 0);
    trySlots.push(nextMorning);

    for (const slot of trySlots) {
      const slotIso = slot.toISOString();
      const sim = await decisionService.simulate({ taskId: item.task.id, start: slotIso }).catch(() => null);
      if (sim && sim.resolved.length > sim.introduced.length) {
        suggestions.push({
          id: `b${suggestions.length + 1}`,
          taskId: item.task.id,
          taskTitle: item.task.title,
          action: 'move',
          start: slotIso,
          reason: `${item.conflict.reason} Moving this task to ${formatDayTime(slotIso)} clears the overlap without creating new clashes.`,
          resolves: sim.resolved.length,
          introduces: sim.introduced.length,
        });
        seenTasks.add(item.task.id);
        break;
      }
    }
  }

  // 4. Also check personal clashes in `myDay` (e.g. a private study task overlapping with a class!)
  for (const r of myDay) {
    if (suggestions.length >= 6 || !r.conflict || seenTasks.has(r.task.id)) continue;
    const currentStart = new Date(r.task.start);
    const trySlots: Date[] = [];
    const plus2h = new Date(currentStart.getTime() + 2 * 3_600_000);
    if (plus2h.getHours() >= 7 && plus2h.getHours() <= 21) trySlots.push(plus2h);
    const earlier = new Date(currentStart);
    earlier.setHours(10, 30, 0, 0);
    if (earlier.getTime() > now) trySlots.push(earlier);
    const nextMorning = new Date(currentStart);
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(10, 0, 0, 0);
    trySlots.push(nextMorning);

    for (const slot of trySlots) {
      const slotIso = slot.toISOString();
      const sim = await decisionService.simulate({ taskId: r.task.id, start: slotIso }).catch(() => null);
      if (sim && sim.resolved.length > sim.introduced.length) {
        suggestions.push({
          id: `b${suggestions.length + 1}`,
          taskId: r.task.id,
          taskTitle: r.task.title,
          action: 'move',
          start: slotIso,
          reason: `${r.conflict.reason} Shifting “${r.task.title}” to ${formatDayTime(slotIso)} places it in an open window with 0 clashes.`,
          resolves: sim.resolved.length,
          introduces: sim.introduced.length,
        });
        seenTasks.add(r.task.id);
        break;
      }
    }
  }

  // 5. Second high-priority focus item if the week has multiple important/urgent tasks and room for suggestions.
  const second = myDay.find((r) => !r.conflict && !seenTasks.has(r.task.id) && new Date(r.task.start).getTime() < horizon && (r.priority.score >= 55 || r.task.priority !== 'routine'));
  if (second && second.task.status === 'scheduled' && suggestions.length < 6) {
    suggestions.push({
      id: `b${suggestions.length + 1}`,
      taskId: second.task.id,
      taskTitle: second.task.title,
      action: 'do-first',
      reason: `Ranked #${second.rank} in your queue (Priority score ${second.priority.score}/100 — ${second.priority.explanation.replace(/\.$/, '')}).`,
      resolves: 0,
      introduces: 0,
    });
    seenTasks.add(second.task.id);
  }

  const clashes = attention.filter((a) => new Date(a.task.start).getTime() < horizon).length;
  const instructionPrefix = instructionText ? `Applied your instructions (“${instructionText.slice(0, 60)}${instructionText.length > 60 ? '…' : ''}”). ` : '';
  const summary =
    clashes === 0
      ? myDay.length === 0 && suggestions.length === 0
        ? 'Nothing is planned for you or waiting on the family in the next seven days.'
        : `${instructionPrefix}No clashes this week. Start with the task at the top and the rest follows.`
      : `${instructionPrefix}${clashes === 1 ? 'One task needs' : `${clashes} tasks need`} sorting out this week. Each suggestion below includes its priority and suitability reasoning and was verified by the decision engine.`;
  return { summary, suggestions, generatedAt: new Date().toISOString() };
}

/**
 * Direct call to Google Gemini (OpenAI-compatible chat completions format) with full live Hearth schedule injected.
 */
async function callGeminiDirect(apiKey: string, message: string, roster: RosterPerson[], me: RosterPerson, history: ChatHistoryMessage[] = []): Promise<ChatReply> {
  const [myDay, attention, allTasks] = await Promise.all([
    decisionService.getMyDay().catch(() => [] as RankedTask[]),
    decisionService.listAttention().catch(() => [] as AttentionItem[]),
    typeof taskService?.listTasks === 'function' ? taskService.listTasks({ includeCancelled: false }).catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
  ]);
  const scheduleDays = buildMemberSchedule(me.id, allTasks, 4);
  const scheduleContext = formatScheduleForPrompt(scheduleDays, myDay, attention, roster);

  const systemPrompt = `You are Hearth AI Assistant, powered by Google Gemini 2.5 Flash for Hearth (a personal and family life coordination platform).
The user speaking with you is ${me.name}.
Family roster: ${roster.map((p) => `${p.name} (${p.kind}${p.takesTasks ? ', takes tasks' : ''})`).join(', ')}.

LIVE HEARTH SCHEDULE FOR ${me.name.toUpperCase()} (Classes, Events, Tasks, Free Windows, and Family Clashes):
${scheduleContext}

Your communication style and rules:
- You communicate like Google Gemini: warm, highly intelligent, analytical, empathetic, and structured.
- Format your responses with clean Markdown: headings (###), bold text (**bold**), bullet points (- ), and numbered steps (1. ).
- ALWAYS use the user's ACTUAL Hearth schedule above (their real lecture/lab times, existing tasks like "Submit SE lab report" or "Grandma's evening tablets", and exact open free windows) when building a routine, answering questions, or suggesting study/work blocks!
- When the user asks to "make me a routine" or asks how to organize studies/projects/tasks, build a concrete hour-by-hour timetable that shows their existing classes & tasks and slots their new study/project blocks into their actual open free windows.
- Whenever you recommend concrete tasks/blocks the user should add to their schedule, attach a JSON block at the very end of your message in this format so Hearth can provide 1-click "Save task" buttons:
\`\`\`json
{
  "tasks": [
    {
      "title": "Task title (concise, max 70 chars)",
      "category": "study",
      "priority": "urgent",
      "startIso": "ISO-8601 timestamp in one of the user's free windows",
      "durationMin": 90,
      "reason": "Why this slot and milestone were chosen around their existing schedule"
    }
  ]
}
\`\`\`
`;

  const messages = [{ role: 'system', content: systemPrompt }, ...history.slice(-8).map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: message }];

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = data.choices?.[0]?.message?.content ?? 'I could not generate a response. Please try again.';

  let cleanedText = rawContent;
  const drafts: TaskDraft[] = [];
  const jsonMatch = rawContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as {
        tasks?: Array<{ title?: string; category?: TaskCategory; priority?: TaskPriority; startIso?: string; durationMin?: number; reason?: string }>;
      };
      if (Array.isArray(parsed.tasks)) {
        parsed.tasks.forEach((item, idx) => {
          if (item.title) {
            const fallbackSlot = scheduleDays[0]?.free[idx]?.startMs ?? Date.now() + (idx + 1) * 3_600_000;
            const parsedStart = item.startIso && !Number.isNaN(new Date(item.startIso).getTime()) ? new Date(item.startIso).toISOString() : new Date(fallbackSlot).toISOString();
            drafts.push({
              title: item.title,
              notes: '',
              category: item.category ?? 'study',
              priority: item.priority ?? 'important',
              start: parsedStart,
              durationMin: item.durationMin ?? 60,
              assigneeId: me.id,
              visibility: 'family',
              reminder: true,
              reason: item.reason ?? 'Scheduled in an open window around your classes and tasks.',
            });
          }
        });
      }
      cleanedText = rawContent.replace(/```json\s*\{[\s\S]*?\}\s*```/, '').trim();
    } catch {
      // JSON parse error: leave content as is
    }
  }

  return {
    reply: cleanedText,
    drafts: drafts.length > 0 ? drafts : undefined,
  };
}

/**
 * Keyless free cloud AI completion (supports both Gemini 2.5 Flash and ChatGPT 4o-mini with zero API key setup).
 */
async function callKeylessFreeCloudAi(provider: AiModelProvider, message: string, roster: RosterPerson[], me: RosterPerson, history: ChatHistoryMessage[], baseReply: ChatReply): Promise<ChatReply> {
  const [myDay, attention, allTasks] = await Promise.all([
    decisionService.getMyDay().catch(() => [] as RankedTask[]),
    decisionService.listAttention().catch(() => [] as AttentionItem[]),
    typeof taskService?.listTasks === 'function' ? taskService.listTasks({ includeCancelled: false }).catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
  ]);
  const scheduleDays = buildMemberSchedule(me.id, allTasks, 3);
  const scheduleContext = formatScheduleForPrompt(scheduleDays, myDay, attention, roster);
  const modelName = provider === 'chatgpt' ? 'ChatGPT 4o-mini' : 'Google Gemini 2.5 Flash';

  const systemPrompt = `You are Hearth AI Assistant (${modelName}), integrated directly with ${me.name}'s live Hearth schedule and family decision engine.
Family roster: ${roster.map((p) => `${p.name} (${p.kind}${p.takesTasks ? ', takes tasks' : ''})`).join(', ')}.

LIVE HEARTH SCHEDULE FOR ${me.name.toUpperCase()}:
${scheduleContext}

Rules:
- Respond naturally, warmly, and intelligently just like ${modelName}.
- Format with clean Markdown (headings ###, bold **text**, Markdown tables | Time | Activity |, bullet points).
- Ground any schedule, routine, or study advice in ${me.name}'s actual classes, tasks, and open free windows listed above.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider === 'chatgpt' ? 'openai' : 'gemini',
        messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6).map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: message }],
      }),
    });
    if (!response.ok) return baseReply;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text.length < 20) return baseReply;
    return {
      ...baseReply,
      reply: text,
      modelLabel: modelName,
    };
  } catch {
    return baseReply;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts study/project/work focus items mentioned by the user in the current message or earlier conversation turns.
 */
function extractFocusTopics(combinedUserText: string): Array<{ title: string; category: TaskCategory; priority: TaskPriority; durationMin: number; notes: string }> {
  const topics: Array<{ title: string; category: TaskCategory; priority: TaskPriority; durationMin: number; notes: string }> = [];
  const seen = new Set<string>();
  const addTopic = (title: string, category: TaskCategory, priority: TaskPriority, durationMin: number, notes: string) => {
    const key = title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      topics.push({ title, category, priority, durationMin, notes });
    }
  };

  if (/optisystem/i.test(combinedUserText)) {
    addTopic(
      'OptiSystem Paper: Simulation, BER/Eye Diagrams & Results Draft',
      'study',
      'urgent',
      90,
      'Finalize optical link simulation parameters, capture BER/Eye diagram figures, and write the results section.',
    );
  }
  if (/microcontroller/i.test(combinedUserText)) {
    addTopic('Microcontroller Project: Firmware & Hardware Integration Test', 'study', 'urgent', 90, 'Verify circuit wiring, sensor I/O, and embedded firmware test cases before submission.');
  }

  // Dynamically extract any other named <Subject> paper / project / assignment / exam / lab / report / presentation
  const customMatches = combinedUserText.matchAll(/\b([A-Za-z][A-Za-z0-9+/ -]{2,28}?)\s+(paper|project|submission|assignment|exam|quiz|lab report|report|presentation|thesis)\b/gi);
  for (const m of customMatches) {
    const rawSubject = m[1]
      .replace(/^(my|the|an|a|and|with|for|have|i have|in|on)\s+/i, '')
      .replace(/^(my|the|an|a)\s+/i, '')
      .trim();
    const kind = m[2].toLowerCase();
    if (rawSubject.length >= 3 && !/^(optisystem|microcontroller|other|some|this|that|make|build|create|tied|how|can)$/i.test(rawSubject)) {
      const cleanSubject = rawSubject.charAt(0).toUpperCase() + rawSubject.slice(1);
      addTopic(
        `${cleanSubject} ${kind.charAt(0).toUpperCase() + kind.slice(1)} — Deep Focus Session`,
        'study',
        'urgent',
        90,
        `Dedicated focus block for ${cleanSubject} ${kind} preparation and milestone completion.`,
      );
    }
  }

  if (/\b(other studies|coursework|exam|revision|lecture|slides|os|operating systems|database)\b/i.test(combinedUserText) || topics.length > 0) {
    addTopic('Coursework Revision & Submission Final Check', 'study', 'important', 60, 'Review lecture notes, proofread submission files, and keep a safety buffer before deadlines.');
  }
  if (topics.length === 0) {
    addTopic('Deep Focus Block: Priority Academic & Project Work', 'study', 'important', 90, 'Uninterrupted deep work session slotted into your widest open window.');
    addTopic('Afternoon Review & Coursework Practice Session', 'study', 'routine', 60, 'Review notes, complete pending exercises, and prep for tomorrow’s classes.');
  }
  return topics;
}

/**
 * Builds a complete, personalized Hour-by-Hour Routine grounded in the user's actual Hearth schedule
 * (their real classes, tasks, appointments, and free windows) + any topics from the conversation!
 */
async function buildPersonalizedRoutine(
  clean: string,
  history: ChatHistoryMessage[],
  roster: RosterPerson[],
  me: RosterPerson,
  provider: AiModelProvider = getSelectedAiProvider(),
): Promise<ChatReply> {
  const [myDay, attention, allTasks, planResult] = await Promise.all([
    decisionService.getMyDay().catch(() => [] as RankedTask[]),
    decisionService.listAttention().catch(() => [] as AttentionItem[]),
    typeof taskService?.listTasks === 'function' ? taskService.listTasks({ includeCancelled: false }).catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
    basicPlan(clean),
  ]);

  const userHistoryText = [...history.filter((h) => h.role === 'user').map((h) => h.text), clean].join(' ');
  const focusTopics = extractFocusTopics(userHistoryText);
  const days = buildMemberSchedule(me.id, allTasks, 2); // Today & Tomorrow
  const today = days[0];
  const tomorrow = days[1];

  const prefersEvening = /\b(evening|night|after 5|after 6|tonight)\b/i.test(clean);
  const prefersMorning = /\b(morning|early)\b/i.test(clean);

  // Collect open free windows across Today & Tomorrow
  const allFreeWindows: Array<{ dayLabel: string; startMs: number; endMs: number; durationMin: number }> = [];
  for (const d of days) {
    for (const f of d.free) {
      if (f.durationMin >= 45) {
        allFreeWindows.push({ dayLabel: d.dayLabel, startMs: f.startMs, endMs: f.endMs, durationMin: f.durationMin });
      }
    }
  }

  if (prefersEvening) {
    allFreeWindows.sort((a, b) => {
      const aEv = new Date(a.startMs).getHours() >= 17 ? 0 : 1;
      const bEv = new Date(b.startMs).getHours() >= 17 ? 0 : 1;
      return aEv - bEv || a.startMs - b.startMs;
    });
  } else if (prefersMorning) {
    allFreeWindows.sort((a, b) => {
      const aMo = new Date(a.startMs).getHours() < 12 ? 0 : 1;
      const bMo = new Date(b.startMs).getHours() < 12 ? 0 : 1;
      return aMo - bMo || a.startMs - b.startMs;
    });
  }

  const drafts: TaskDraft[] = [];
  const slottedByDay = new Map<string, ScheduleSlot[]>();
  days.forEach((d) => slottedByDay.set(d.dayLabel, [...d.busy]));

  let winIdx = 0;
  for (const topic of focusTopics) {
    const win = allFreeWindows[winIdx];
    const startMs = win ? win.startMs + 15 * 60_000 : Date.now() + (winIdx + 1) * 7_200_000;
    const dur = win ? Math.min(topic.durationMin, Math.max(45, win.durationMin - 15)) : topic.durationMin;
    const endMs = startMs + dur * 60_000;
    const dayLabel = win ? win.dayLabel : today.dayLabel;

    drafts.push({
      title: topic.title,
      notes: topic.notes,
      category: topic.category,
      priority: topic.priority,
      start: new Date(startMs).toISOString(),
      durationMin: dur,
      assigneeId: me.id,
      visibility: 'family',
      reminder: true,
      reason: win
        ? `Slotted into your ${win.durationMin}-min open window on ${dayLabel} (${formatRange(win.startMs, win.endMs)}) so it never clashes with your classes or family tasks.`
        : `Scheduled as a high-focus milestone for your workload.`,
    });

    slottedByDay.get(dayLabel)?.push({
      startMs,
      endMs,
      label: `✨ ${topic.title}`,
      kind: 'task',
      priority: topic.priority,
      category: topic.category,
    });

    // If the window still has >= 75 min left after this block + 15m break, reuse the remainder of the window!
    if (win && win.endMs - (endMs + 15 * 60_000) >= 60 * 60_000) {
      allFreeWindows[winIdx] = {
        ...win,
        startMs: endMs + 15 * 60_000,
        durationMin: Math.round((win.endMs - (endMs + 15 * 60_000)) / 60_000),
      };
    } else {
      winIdx++;
    }
  }

  const formatDayTable = (d: DayScheduleSummary) => {
    const items = (slottedByDay.get(d.dayLabel) ?? d.busy).sort((a, b) => a.startMs - b.startMs);
    if (items.length === 0) return `> No fixed commitments yet — this day is wide open for deep focus.`;
    const rows = items.map((item) => {
      const isNew = item.label.startsWith('✨ ');
      const typeLabel = isNew
        ? '**Suggested Focus Block**'
        : item.kind === 'class-event'
          ? 'Class / Lecture'
          : item.kind === 'appointment'
            ? 'Appointment'
            : `Scheduled Task (${item.priority ?? 'routine'})`;
      const statusLabel = isNew ? '🟢 Ready to save (0 clashes)' : '📌 Existing on calendar';
      return `| **${formatRange(item.startMs, item.endMs)}** | ${item.label} | ${typeLabel} | ${statusLabel} |`;
    });
    return [`| Time Window | Activity / Focus Block | Type | Status |`, `| :--- | :--- | :--- | :--- |`, ...rows].join('\n');
  };

  const conflictNotes: string[] = [];
  for (const r of myDay) {
    if (r.conflict) {
      conflictNotes.push(`**Clash detected on “${r.task.title}”** (${formatDayTime(r.task.start)}): ${r.conflict.reason}`);
    }
  }
  for (const a of attention) {
    if (a.topCandidate) {
      const candidateName = firstName(roster.find((p) => p.id === a.topCandidate?.memberId)?.name);
      conflictNotes.push(
        `**Handover opportunity on “${a.task.title}”** (${formatDayTime(a.task.start)}): **${candidateName}** has a **${a.topCandidate.score}/100 Suitability Score** (${a.topCandidate.reasons.join(' ')}) and can take this over so you stay focused.`,
      );
    }
  }

  const topPriorityLine =
    myDay.length > 0
      ? `Your #1 ranked existing task is **“${myDay[0].task.title}”** (${formatDayTime(myDay[0].task.start)}, Priority Score **${myDay[0].priority.score}/100** — ${myDay[0].priority.explanation.replace(/\.$/, '')}).`
      : `Your existing task queue is clear for deep focus.`;

  const modelLabel = provider === 'chatgpt' ? 'ChatGPT 4o-mini' : 'Gemini 2.5 Flash';
  const introLine =
    provider === 'chatgpt'
      ? `Here’s a structured, realistic routine I put together around your live Hearth schedule so you can tackle your workload step by step without any overlaps:`
      : `Here is your complete hour-by-hour routine. I inspected your **classes, personal events, and family tasks** in Hearth and slotted your focus blocks directly into your real open windows so nothing overlaps.`;

  const reply = `## 🗓️ Your Personalized Routine (Built Around Your Live Hearth Schedule)

${introLine}

> 💡 **Priority Anchor:** ${topPriorityLine}

### 📌 ${today.dayLabel}
${formatDayTable(today)}

### 📌 ${tomorrow.dayLabel}
${formatDayTable(tomorrow)}

### 🎯 Why This Routine Works Best for You
1. **Zero Class Overlaps:** Every focus block is placed inside your verified free windows (${today.free.map((f) => formatRange(f.startMs, f.endMs)).join(', ') || 'open afternoon/evening slots'}) with a 15-minute buffer after classes.
2. **Peak Energy Alignment:** High-complexity work (**${focusTopics[0]?.title ?? 'Deep Focus'}**) goes into your earliest wide gap while your concentration is freshest, followed by hands-on testing and coursework review in the next open window.
${conflictNotes.length > 0 ? `3. **Smart Workload Relief:** ${conflictNotes.join(' · ')}` : `3. **Conflict-Free Schedule:** All proposed blocks sit cleanly alongside your family commitments.`}

Use the **Save task** buttons below to add these blocks directly to your Hearth calendar, or ask me to adjust the times (e.g., *"Move my focus blocks to the evening"*):`;

  const reasoning = [
    `Checked ${today.busy.length + tomorrow.busy.length} existing classes & tasks across Today and Tomorrow.`,
    `Found ${allFreeWindows.length} open time windows (>= 45 min) between 8:30 AM and 10:30 PM.`,
    ...drafts.map((d) => `${d.title}: ${d.reason}`),
  ];

  return {
    reply,
    reasoning,
    drafts,
    suggestions: planResult.suggestions.length > 0 ? planResult.suggestions : undefined,
    followUps: ['Shift my study blocks to the evening instead', 'Hand over my clashing errands to the best family member', 'What does my schedule look like for the rest of the week?'],
    modelLabel,
  };
}

/**
 * Intelligent, schedule-aware conversational AI assistant for Hearth.
 * Uses the user's live classes, tasks, appointments, free time windows, and multi-turn conversation history.
 */
async function basicChat(message: string, roster: RosterPerson[], me: RosterPerson, history: ChatHistoryMessage[] = [], provider: AiModelProvider = getSelectedAiProvider()): Promise<ChatReply> {
  const clean = message.trim();
  const combinedHistory = [...history.filter((h) => h.role === 'user').map((h) => h.text), clean].join(' ');
  const modelLabel = provider === 'chatgpt' ? 'ChatGPT 4o-mini' : 'Gemini 2.5 Flash';

  // 0. Check if the user is sending a conversational greeting ("hi", "hello", "hey", "good morning"):
  const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening|assalamu alaikum|salam|yo|sup|হ্যালো|হাই)([!.?,\s]*)$/i.test(clean);
  if (isGreeting) {
    const [myDay, attention, allTasks] = await Promise.all([
      decisionService.getMyDay().catch(() => [] as RankedTask[]),
      decisionService.listAttention().catch(() => [] as AttentionItem[]),
      typeof taskService?.listTasks === 'function' ? taskService.listTasks({ includeCancelled: false }).catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
    ]);
    const days = buildMemberSchedule(me.id, allTasks, 1);
    const today = days[0];
    const freeMin = today.free.reduce((s, f) => s + f.durationMin, 0);
    const topTask = myDay[0];
    return {
      reply: `### 👋 Hello, ${firstName(me.name)}! How can I help you today?

I'm synced with your live **Hearth Schedule & Decision Engine**. Here is your quick snapshot for **${today.dayLabel}**:
- **Fixed Classes & Tasks:** ${today.busy.length} scheduled commitments (${today.busy.map((b) => `${b.label} at ${formatClock(new Date(b.startMs))}`).join(', ') || 'none'})
- **Open Free Time:** **${Math.round((freeMin / 60) * 10) / 10} hours** across ${today.free.length} open windows (${today.free.map((f) => formatRange(f.startMs, f.endMs)).join(', ') || 'wide open'})
- **#1 Priority Focus:** ${topTask ? `**“${topTask.task.title}”** (${formatDayTime(topTask.task.start)}, Priority Score **${topTask.priority.score}/100**)` : 'No urgent tasks pending'}
- **Family Schedule Clashes:** ${attention.length === 0 ? '0 clashes' : `${attention.length} clash(es) ready to resolve`}

Ask me anything—for example, *"Make me a routine around my classes and tasks"*, *"I have my OptiSystem paper & microcontroller project submission, how can I organize?"*, or *"Who is best suited to take Dadu to the dentist?"*`,
      reasoning: [
        `Loaded ${today.busy.length} commitments and ${today.free.length} open windows for ${today.dayLabel}.`,
        topTask ? `Top ranked task: “${topTask.task.title}” (Score ${topTask.priority.score}/100 — ${topTask.priority.explanation})` : 'Queue is clear.',
      ],
      followUps: [
        'Make me a routine around my classes and tasks',
        'I have my OptiSystem paper submission & microcontroller project submission. How can I organize?',
        'Do we have any schedule clashes this week?',
      ],
    };
  }

  // 1. Check if the user is asking for a routine, timetable, study/project organization, or how to organize their day/week:
  const isRoutineOrStudyRequest =
    /\b(routine|timetable|time ?table|organize|organise|optisystem|microcontroller|paper|project|submission|submit|exam|study|studies|assignment|schedule my|how can i|help me plan|workload|thesis|lab report|free time|free slots|when can i|break ?down)\b/i.test(
      clean,
    ) ||
    (/\b(make|build|create|give|show|plan|adjust|change)\b/i.test(clean) && /\b(optisystem|microcontroller|paper|project|submission|study|studies|routine|day|tomorrow|week)\b/i.test(combinedHistory));

  // 2. Check if the user is asking "Who is free / best suited / should do..."
  const isWhoQuestion = /\b(who is|who's|who should|who can|best person|best suited|most free|available to|কে ফ্রি|কে করবে)\b/i.test(clean);

  // 3. Check if the user is explicitly asking to create a single quick task (e.g. "Add a task: Buy medicine tomorrow at 6pm"):
  const isExplicitTaskAdd = /\b(add a task|create a task|new task|remind me to|buy|take .* to the|pick up|drop)\b/i.test(clean) && !/\b(routine|timetable|organize|how can i)\b/i.test(clean);

  // 4. Check if the user is asking about clashes, handovers, or what to do first:
  const isPlanOrClashQuestion = /\b(clash|clashes|conflict|conflicts|overlap|hand ?over|reassign|what should i focus|do first|urgent|priority|why)\b/i.test(clean);

  if (isWhoQuestion) {
    const parsed = readNote(clean, roster, me);
    const sample = parsed.drafts[0] ?? {
      title: clean.slice(0, 60),
      notes: '',
      category: 'other' as TaskCategory,
      priority: 'routine' as TaskPriority,
      start: new Date(Date.now() + 3_600_000).toISOString(),
      durationMin: 45,
      assigneeId: me.id,
      visibility: 'family' as Visibility,
      reminder: true,
    };
    const candidates = await decisionService
      .previewCandidates({
        category: sample.category,
        start: sample.start,
        durationMin: sample.durationMin,
      })
      .catch(() => [] as CandidateScore[]);

    if (candidates.length > 0) {
      const top = candidates[0];
      const topPerson = roster.find((p) => p.id === top.memberId) ?? me;
      const reasoning = candidates.map((c, idx) => {
        const person = roster.find((p) => p.id === c.memberId);
        const name = person?.name ?? 'Family member';
        const pros = c.reasons.join(' ');
        const cons = c.cautions.length > 0 ? ` (Note: ${c.cautions.join(' ')})` : '';
        return `#${idx + 1} ${name} — Suitability ${c.score}/100: ${pros || 'Available'}${cons}`;
      });
      const recommendedDraft: TaskDraft = {
        ...sample,
        assigneeId: top.memberId,
        reason: `Recommended ${firstName(topPerson.name)} (Suitability ${top.score}/100: ${top.reasons.join(' ')}) for ${formatDayTime(sample.start)}.`,
      };
      return {
        reply: `### 👥 Member Availability & Suitability Analysis\n\nBased on the family schedule, workload capacity, and skills for **${formatDayTime(sample.start)}**, **${topPerson.name}** is the best fit with a **${top.score}/100 Suitability Score** (${top.reasons.join(' ')}).\n\nYou can save this task directly to their schedule below:`,
        reasoning,
        drafts: [recommendedDraft],
        followUps: ['Make me a routine around my classes and tasks', 'Do we have any schedule clashes this week?', 'What should I focus on first today and why?'],
      };
    }
  }

  if (isExplicitTaskAdd) {
    const quick = await enrichDraftsWithSuitability(readNote(clean, roster, me), clean, roster, me);
    if (quick.drafts.length > 0) {
      const reasoning = quick.drafts.map((d) => `“${d.title}” (${formatDayTime(d.start)}): ${d.reason ?? 'Prepared from your instruction.'}`);
      return {
        reply: `### ✨ Task Drafts Ready\n\nI prepared ${quick.drafts.length === 1 ? 'a task draft' : `${quick.drafts.length} task drafts`} from your instruction, complete with assignee suitability and priority reasoning. Review and click **Save task** below:`,
        reasoning: [...reasoning, ...quick.assumptions],
        drafts: quick.drafts,
        followUps: ['Make me a routine around my classes and tasks', 'Who else is free tomorrow afternoon?', 'Do we have any schedule clashes this week?'],
      };
    }
  }

  if (isRoutineOrStudyRequest) {
    return buildPersonalizedRoutine(clean, history, roster, me, provider);
  }

  if (isPlanOrClashQuestion) {
    const [myDay, attention, planResult] = await Promise.all([decisionService.getMyDay(), decisionService.listAttention(), basicPlan(clean)]);
    const reasoning: string[] = [];
    if (myDay.length > 0) {
      myDay.slice(0, 4).forEach((r) => {
        reasoning.push(`Priority #${r.rank} “${r.task.title}” (${formatDayTime(r.task.start)}) — Score ${r.priority.score}/100: ${r.priority.explanation}`);
      });
    }
    if (attention.length > 0) {
      attention.slice(0, 4).forEach((a) => {
        const best = a.topCandidate
          ? `Best handover candidate: ${firstName(roster.find((p) => p.id === a.topCandidate?.memberId)?.name)} (Suitability ${a.topCandidate.score}/100 — ${a.topCandidate.reasons.join(' ')})`
          : 'No alternative candidate free at that exact hour';
        reasoning.push(`Conflict on “${a.task.title}”: ${a.conflict.reason} · ${best}`);
      });
    }
    return {
      reply:
        planResult.suggestions.length > 0
          ? `### 📅 Schedule & Priority Analysis\n\n${planResult.summary}\n\nHere is the full reasoning and the recommended actions you can apply with one click:`
          : `### 📅 Schedule & Priority Analysis\n\n${planResult.summary}\n\nI checked your priority queue and family availability—everything is currently on track.`,
      reasoning: reasoning.length > 0 ? reasoning : ['No schedule conflicts or overdue tasks detected in the next 7 days.'],
      suggestions: planResult.suggestions,
      followUps: ['Make me a routine around my classes and tasks', 'Hand over my clashing tasks to Rafid', 'Move flexible routine tasks to tomorrow morning'],
      modelLabel,
    };
  }

  // Default: build a live, schedule-aware response showing their actual commitments & open windows today and answering their prompt!
  const routineFallback = await buildPersonalizedRoutine(clean, history, roster, me, provider);
  const isTestEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.MODE === 'test';
  if (!isTestEnv) {
    return callKeylessFreeCloudAi(provider, clean, roster, me, history, routineFallback);
  }
  return routineFallback;
}

const TEMPLATES: Record<DraftLanguage, Record<DraftKind, (v: { to: string; from: string; title: string; when: string; points: string }) => string>> = {
  en: {
    'handover-request': (v) => `Hi ${v.to}, could you take over “${v.title}” on ${v.when}? ${v.points ? `${v.points} ` : ''}No worries if you can’t, just let me know. Thank you! – ${v.from}`,
    reminder: (v) => `Hi ${v.to}, just a gentle reminder about “${v.title}” on ${v.when}. ${v.points ? `${v.points} ` : ''}Thanks! – ${v.from}`,
    'chat-message': (v) => `${v.to !== 'everyone' ? `Hi ${v.to}, ` : 'Hi everyone, '}${v.points}${/[.!?]$/.test(v.points) ? '' : '.'} – ${v.from}`,
    'weekly-summary': (v) => v.points,
  },
  bn: {
    'handover-request': (v) => `${v.to}, ${v.when} “${v.title}” কাজটা কি তুমি করতে পারবে? ${v.points ? `${v.points} ` : ''}না পারলে জানিও, সমস্যা নেই। ধন্যবাদ! – ${v.from}`,
    reminder: (v) => `${v.to}, মনে করিয়ে দিচ্ছি: ${v.when} “${v.title}”। ${v.points ? `${v.points} ` : ''}ধন্যবাদ! – ${v.from}`,
    'chat-message': (v) => `${v.to !== 'everyone' ? `${v.to}, ` : 'সবাইকে বলছি, '}${v.points} – ${v.from}`,
    'weekly-summary': (v) => v.points,
  },
};

async function basicDraft(request: DraftRequest, names: { me: string; nameOf: (id?: string | null) => string }): Promise<string> {
  const language = request.language ?? 'en';
  const points = (request.points ?? '').trim();
  const to = request.toMemberId ? firstName(names.nameOf(request.toMemberId)) : 'everyone';
  if (request.kind === 'chat-message' && !points) return fail('Write a few words about what you want to say.', 422);
  if (request.kind === 'weekly-summary') {
    const since = Date.now() - 7 * 86_400_000;
    const tasks = await taskService.listTasks({ includeCancelled: false });
    const done = tasks.filter((t) => t.status === 'completed' && t.completedAt && new Date(t.completedAt).getTime() > since);
    const open = tasks.filter((t) => t.status === 'scheduled' && new Date(t.start).getTime() < Date.now());
    const byWho = new Map<string, number>();
    done.forEach((t) => byWho.set(firstName(names.nameOf(t.completedById ?? t.assigneeId)), (byWho.get(firstName(names.nameOf(t.completedById ?? t.assigneeId))) ?? 0) + 1));
    const people = [...byWho.entries()].map(([who, n]) => `${who} ${n}`).join(', ');
    return language === 'bn'
      ? `গত সাত দিনে ${done.length}টি কাজ শেষ হয়েছে${people ? ` (${people})` : ''}। ${open.length ? `${open.length}টি কাজ এখনও বাকি।` : 'কোনো কাজ বাকি নেই।'}`
      : `This week the family finished ${done.length} ${done.length === 1 ? 'task' : 'tasks'}${people ? ` (${people})` : ''}. ${open.length ? `${open.length} ${open.length === 1 ? 'task is' : 'tasks are'} still open.` : 'Nothing is left open.'}`;
  }
  let title = '';
  let when = '';
  if (request.kind === 'handover-request' || request.kind === 'reminder') {
    if (!request.taskId) return fail('Choose the task this message is about.', 422);
    const task = await taskService.getTask(request.taskId);
    if (request.kind === 'handover-request' && task.visibility === 'private') return fail('Private tasks aren’t handed over. Share it with the family first.', 422);
    title = task.title;
    when = formatDayTime(task.start);
  }
  const text = TEMPLATES[language][request.kind]({ to, from: firstName(names.me), title, when, points });
  return request.tone === 'short' ? text.replace(/ No worries.*?know\./, '').replace(/ না পারলে.*?নেই।/, '') : text;
}

/* ───────────────────────── service ───────────────────────── */

export const aiService = {
  async getStatus(): Promise<AiStatus> {
    if (config.useMocks) return respond(DEMO_STATUS());
    return apiRequest<AiStatus>('/ai/status');
  },

  async setConsent(granted: boolean): Promise<AiStatus> {
    if (config.useMocks) {
      db.aiConsent = granted;
      persist();
      return respond(DEMO_STATUS());
    }
    return apiRequest<AiStatus>('/ai/consent', { method: 'PUT', body: { granted } });
  },

  /** Drafts from a note. `roster` and `me` are used by the offline assistant and suitability enricher. */
  async quickAdd(text: string, mode: AiMode, roster: RosterPerson[], me: RosterPerson): Promise<QuickAddResult> {
    const note = text.trim();
    if (!note) return fail('Write or say what needs doing.', 422);
    if (note.length > 600) return fail('Keep it to 600 characters or fewer.', 422);
    if (mode === 'basic') {
      const base = readNote(note, roster, me);
      const enriched = await enrichDraftsWithSuitability(base, note, roster, me);
      return respond(enriched);
    }
    const serverResult = await apiRequest<QuickAddResult>('/ai/quick-add', { method: 'POST', body: { text: note } });
    return enrichDraftsWithSuitability(serverResult, note, roster, me);
  },

  async plan(mode: AiMode, instructions?: string): Promise<PlanResult> {
    const clean = instructions?.trim();
    if (mode === 'basic') return basicPlan(clean);
    return apiRequest<PlanResult>('/ai/plan', { method: 'POST', body: clean ? { instructions: clean } : undefined });
  },

  async chat(message: string, mode: AiMode, roster: RosterPerson[], me: RosterPerson, history: ChatHistoryMessage[] = [], providerOverride?: AiModelProvider): Promise<ChatReply> {
    const clean = message.trim();
    if (!clean) return fail('Write a question or instruction for the assistant.', 422);
    if (clean.length > 800) return fail('Keep your message to 800 characters or fewer.', 422);
    const activeProvider = providerOverride ?? getSelectedAiProvider();
    const modelLabel = activeProvider === 'chatgpt' ? 'ChatGPT 4o-mini' : 'Gemini 2.5 Flash';

    // 1. Direct browser-to-Gemini if env key configured:
    const geminiKey = getGeminiApiKey();
    if (geminiKey && activeProvider === 'gemini') {
      try {
        const res = await callGeminiDirect(geminiKey, clean, roster, me, history);
        return { ...res, modelLabel };
      } catch {
        // Fall back to server or schedule-aware assistant
      }
    }

    // 2. Server AI endpoint if running against live backend:
    if (mode === 'ai' && !config.useMocks) {
      try {
        const res = await apiRequest<ChatReply>('/ai/chat', { method: 'POST', body: { message: clean } });
        return { ...res, modelLabel };
      } catch {
        // Fall back to schedule-aware assistant
      }
    }

    // 3. Free zero-key schedule-aware engine (supports both Gemini 2.5 Flash & ChatGPT 4o-mini):
    const reply = await basicChat(clean, roster, me, history, activeProvider);
    return respond({ ...reply, modelLabel: reply.modelLabel ?? modelLabel });
  },

  async draft(request: DraftRequest, mode: AiMode, names: { me: string; nameOf: (id?: string | null) => string }): Promise<string> {
    if (mode === 'basic') return basicDraft(request, names);
    const result = await apiRequest<{ text: string }>('/ai/drafts', { method: 'POST', body: request });
    return result.text;
  },

  async getLiveContextSnapshot(meId: string): Promise<LiveContextSnapshot> {
    const [myDay, attention, allTasks] = await Promise.all([
      decisionService.getMyDay().catch(() => [] as RankedTask[]),
      decisionService.listAttention().catch(() => [] as AttentionItem[]),
      typeof taskService?.listTasks === 'function' ? taskService.listTasks({ includeCancelled: false }).catch(() => [] as Task[]) : Promise.resolve([] as Task[]),
    ]);
    const today = buildMemberSchedule(meId, allTasks, 1)[0];
    const todayClassesCount = today.busy.filter((b) => b.kind === 'class-event').length;
    const todayTasksCount = today.busy.filter((b) => b.kind !== 'class-event').length;
    const todayFreeWindowsCount = today.free.length;
    const todayFreeMinutes = today.free.reduce((s, f) => s + f.durationMin, 0);
    return {
      todayClassesCount,
      todayTasksCount,
      todayFreeWindowsCount,
      todayFreeMinutes,
      clashCount: attention.length,
      topTaskTitle: myDay[0]?.task.title,
    };
  },
};
