/**
 * AI help — ai-service.
 *
 * Three things: task drafts from a sentence ("quick add"), a suggested plan for the next seven days, and
 * message drafts. Nothing is ever saved here: the person reviews every result and saves it through the
 * normal services, which apply every rule.
 *
 * Two modes:
 * - `ai`: the server's AI help (needs AI_API_KEY on the server and the person's agreement).
 * - `basic`: the offline assistant in `localAssistant.ts`, used in demo mode and when the server has AI
 *   help switched off. It reads short notes with rules and builds the plan from the decision engine alone.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { db, fail, persist, respond } from '../mockStore';
import { decisionService } from '../decision/decisionService';
import { taskService } from '../tasks/taskService';
import { formatDayTime } from '@/lib/dates';
import type { ID, ISODateTime, TaskCategory, TaskPriority, Visibility } from '@/types/domain';
import { readNote, type RosterPerson } from './localAssistant';

export type AiMode = 'ai' | 'basic';

export interface AiStatus {
  /** The server has AI help configured. False in demo mode. */
  enabled: boolean;
  consented: boolean;
  consentedAt?: ISODateTime;
  usedToday: number;
  dailyLimit: number;
  monthlyBudgetUsedPercent: number;
}

/** Which assistant answers: the server's AI when it is on and the person agreed, otherwise the offline one. */
export const modeOf = (status: AiStatus | undefined): AiMode => (status?.enabled && status.consented ? 'ai' : 'basic');

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

const DEMO_STATUS = (): AiStatus => ({ enabled: false, consented: Boolean(db.aiConsent), usedToday: 0, dailyLimit: 0, monthlyBudgetUsedPercent: 0 });

const firstName = (name: string | undefined) => (name ?? 'there').split(' ')[0];

/* ───────────────────────── basic mode ───────────────────────── */

async function basicPlan(): Promise<PlanResult> {
  const [myDay, attention] = await Promise.all([decisionService.getMyDay(), decisionService.listAttention()]);
  const horizon = Date.now() + 7 * 86_400_000;
  const suggestions: PlanSuggestion[] = [];
  // The top task the person can actually do (one with a clash is offered as a handover instead).
  const first = myDay.find((r) => !r.conflict && new Date(r.task.start).getTime() < horizon);
  if (first && first.task.status === 'scheduled') {
    suggestions.push({
      id: 'b1',
      taskId: first.task.id,
      taskTitle: first.task.title,
      action: 'do-first',
      reason: first.tieBreak ?? first.priority.explanation,
      resolves: 0,
      introduces: 0,
    });
  }
  for (const item of attention) {
    if (suggestions.length >= 6 || new Date(item.task.start).getTime() > horizon) continue;
    const candidate = item.topCandidate;
    if (!candidate || candidate.memberId === item.task.assigneeId || item.task.visibility === 'private') continue;
    const result = await decisionService.simulate({ taskId: item.task.id, assigneeId: candidate.memberId });
    if (result.introduced.length > result.resolved.length) continue;
    suggestions.push({
      id: `b${suggestions.length + 1}`,
      taskId: item.task.id,
      taskTitle: item.task.title,
      action: 'hand-over',
      assigneeId: candidate.memberId,
      reason: `${item.conflict.reason} ${candidate.reasons[0] ?? ''}`.trim(),
      resolves: result.resolved.length,
      introduces: result.introduced.length,
    });
  }
  const clashes = attention.filter((a) => new Date(a.task.start).getTime() < horizon).length;
  const summary =
    clashes === 0
      ? myDay.length === 0
        ? 'Nothing is planned for you or waiting on the family in the next seven days.'
        : 'No clashes this week. Start with the task at the top and the rest follows.'
      : `${clashes === 1 ? 'One task needs' : `${clashes} tasks need`} sorting out this week. The changes below were checked by the decision engine.`;
  return { summary, suggestions, generatedAt: new Date().toISOString() };
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

  /** Drafts from a note. `roster` and `me` are only used by the offline assistant. */
  async quickAdd(text: string, mode: AiMode, roster: RosterPerson[], me: RosterPerson): Promise<QuickAddResult> {
    const note = text.trim();
    if (!note) return fail('Write or say what needs doing.', 422);
    if (note.length > 600) return fail('Keep it to 600 characters or fewer.', 422);
    if (mode === 'basic') return respond(readNote(note, roster, me));
    return apiRequest<QuickAddResult>('/ai/quick-add', { method: 'POST', body: { text: note } });
  },

  async plan(mode: AiMode): Promise<PlanResult> {
    if (mode === 'basic') return basicPlan();
    return apiRequest<PlanResult>('/ai/plan', { method: 'POST' });
  },

  async draft(request: DraftRequest, mode: AiMode, names: { me: string; nameOf: (id?: string | null) => string }): Promise<string> {
    if (mode === 'basic') return basicDraft(request, names);
    const result = await apiRequest<{ text: string }>('/ai/drafts', { method: 'POST', body: request });
    return result.text;
  },
};
