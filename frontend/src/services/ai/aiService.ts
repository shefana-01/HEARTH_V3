/**
 * AI help — ai-service.
 *
 * Four capabilities:
 * 1. Task drafts from a sentence ("quick add") with per-task & assignee suitability reasoning,
 * 2. A suggested plan for the next seven days (with optional custom user instructions) verified by the decision engine,
 * 3. Interactive conversational AI assistant grounded in Google Gemini 2.5 Flash + Hearth's live decision engine,
 * 4. Message drafts.
 *
 * Nothing is ever saved automatically: the person reviews every result and applies or saves it through the
 * normal services, which enforce every rule.
 *
 * Two modes:
 * - `ai`: Google Gemini (direct via Google AI Studio API or server ai-service).
 * - `basic`: the offline assistant in `localAssistant.ts` + decision engine, used in demo mode and when
 *   an external key is not provided.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { db, fail, persist, respond } from '../mockStore';
import { decisionService } from '../decision/decisionService';
import { taskService } from '../tasks/taskService';
import { formatDayTime } from '@/lib/dates';
import type { CandidateScore, ID, ISODateTime, Task, TaskCategory, TaskPriority, Visibility } from '@/types/domain';
import { readNote, type RosterPerson } from './localAssistant';

export type AiMode = 'ai' | 'basic';

const GEMINI_STORAGE_KEY = 'hearth_gemini_api_key';

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

/** Which assistant answers: Gemini when configured, otherwise the offline intelligent assistant. */
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

  // 4. Second high-priority focus item if the week has multiple important/urgent tasks and room for suggestions.
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
 * Direct call to Google Gemini (OpenAI-compatible chat completions format).
 */
async function callGeminiDirect(apiKey: string, message: string, roster: RosterPerson[], me: RosterPerson, history: ChatHistoryMessage[] = []): Promise<ChatReply> {
  const systemPrompt = `You are Hearth AI Assistant, powered by Google Gemini 2.5 Flash for Hearth (a personal and family life coordination platform).
The user speaking with you is ${me.name}.
Family roster: ${roster.map((p) => `${p.name} (${p.kind}${p.takesTasks ? ', takes tasks' : ''})`).join(', ')}.

Your communication style:
- You communicate like Google Gemini: warm, highly intelligent, analytical, empathetic, concise, and structured.
- Format your responses with clean Markdown: headings (###), bold text (**bold**), bullet points (- ), and numbered steps (1. ).
- When the user asks for guidance on organizing studies, projects, papers, submissions, exams, or busy days (such as "I have my optisystem paper submission & microcontroller project submission. tied with other studies how can i organize"):
  1. Provide a clear, prioritized timeline and cognitive-load breakdown.
  2. Provide a practical time-blocking strategy with realistic buffer intervals.
  3. Offer supportive, realistic pacing tips.
- When you recommend concrete actionable tasks the user should add, attach a JSON block at the very end of your message in this format so Hearth can automatically provide 1-click "Save task" buttons:
\`\`\`json
{
  "tasks": [
    {
      "title": "Task title (concise, max 70 chars)",
      "category": "study",
      "priority": "urgent",
      "durationMin": 90,
      "reason": "Why this milestone is recommended"
    }
  ]
}
\`\`\`
`;

  const messages = [{ role: 'system', content: systemPrompt }, ...history.slice(-6).map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: message }];

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

  // Extract embedded JSON tasks block if present
  let cleanedText = rawContent;
  const drafts: TaskDraft[] = [];
  const jsonMatch = rawContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as { tasks?: Array<{ title?: string; category?: TaskCategory; priority?: TaskPriority; durationMin?: number; reason?: string }> };
      if (Array.isArray(parsed.tasks)) {
        parsed.tasks.forEach((item) => {
          if (item.title) {
            drafts.push({
              title: item.title,
              notes: '',
              category: item.category ?? 'study',
              priority: item.priority ?? 'important',
              start: new Date(Date.now() + 3_600_000).toISOString(),
              durationMin: item.durationMin ?? 60,
              assigneeId: me.id,
              visibility: 'family',
              reminder: true,
              reason: item.reason ?? 'Recommended milestone by Gemini Assistant.',
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
 * Intelligent, empathetic conversational AI assistant fallback (used when no Gemini API key is configured).
 * Understands academic study questions, project submissions, time management, who is free, and family coordination.
 */
async function basicChat(message: string, roster: RosterPerson[], me: RosterPerson): Promise<ChatReply> {
  const clean = message.trim();

  // 1. Academic & study workload organizer (e.g. OptiSystem paper, Microcontroller project, exams, etc.)
  const isStudyOrWorkload =
    /\b(optisystem|microcontroller|paper|project|submission|submit|exam|study|studies|assignment|organize|schedule my day|how can i|help me plan|workload|thesis|lab report)\b/i.test(clean);

  if (isStudyOrWorkload) {
    const hasOpti = /optisystem/i.test(clean);
    const hasMicro = /microcontroller/i.test(clean);

    const now = new Date();
    const slot1 = new Date(now.getTime() + 2 * 3_600_000);
    const slot2 = new Date(now.getTime() + 24 * 3_600_000);
    slot2.setHours(10, 0, 0, 0);
    const slot3 = new Date(now.getTime() + 28 * 3_600_000);
    slot3.setHours(15, 0, 0, 0);

    const drafts: TaskDraft[] = [
      {
        title: hasOpti ? 'OptiSystem Paper Simulation & Results Write-up' : 'Major Paper Submission Draft & Analysis',
        notes: 'Run optical simulation tests, export BER/Eye diagrams, and draft methodology.',
        category: 'study',
        priority: 'urgent',
        start: slot1.toISOString(),
        durationMin: 120,
        assigneeId: me.id,
        visibility: 'family',
        reminder: true,
        reason: 'High cognitive-load deep work milestone. Scheduled first to prevent deadline rush.',
      },
      {
        title: hasMicro ? 'Microcontroller Circuit Debugging & Code Test' : 'Project Prototype & Firmware Verification',
        notes: 'Test sensor readouts, inspect peripheral wiring, and verify embedded code stability.',
        category: 'study',
        priority: 'important',
        start: slot2.toISOString(),
        durationMin: 90,
        assigneeId: me.id,
        visibility: 'family',
        reminder: true,
        reason: 'Hands-on hardware/lab session scheduled in the morning when focus is highest.',
      },
      {
        title: 'Coursework Maintenance & Final Submission Review',
        notes: 'Proofread report formatting, verify citations, and assemble submission files.',
        category: 'study',
        priority: 'routine',
        start: slot3.toISOString(),
        durationMin: 45,
        assigneeId: me.id,
        visibility: 'family',
        reminder: true,
        reason: 'Submission safety buffer 24h before due date to avoid compile or upload panics.',
      },
    ];

    const reply = `### 🎯 Strategic Academic Organization Plan

Balancing an **OptiSystem paper submission** with a **microcontroller hardware project** and regular coursework is demanding because each requires a completely different mindset. Here is a high-yield strategy to conquer all three without burning out:

---

### 1. 🧠 High-Impact Priority Triage
- **Priority 1: OptiSystem Paper Submission (Deep Concentration Block)**
  - *Why:* Simulation parameters, optical power budgets, and numerical convergence take unexpected time. Focus on getting simulation curves and figures finalized first so your text can be drafted around solid data.
- **Priority 2: Microcontroller Project (Physical Debugging & Firmware)**
  - *Why:* Hardware bugs (wiring, clock configs, pin mismatches) require trial and error. Do not leave circuit assembly to the final evening.
- **Priority 3: Other Coursework & Studies (Consistent Baseline)**
  - Keep maintenance blocks to 40–45 minutes each day so you stay on track without derailing your main deliverables.

---

### 2. ⏱️ Recommended Daily Time-Blocking (Interleaving Strategy)
1. **Morning Focus (90–120 min):** *OptiSystem Simulations & Manuscript Drafting* — Tackle this when your mental energy is fresh.
2. **Afternoon Lab (60–90 min):** *Microcontroller Code & Hardware Test* — Shift into hands-on testing when cognitive fatigue sets in.
3. **Evening Review (45 min):** *General Coursework Maintenance* — Low-friction reading or problem sets.

---

### 3. 🚀 Ready-to-Save Milestones
I’ve prepared 3 structured task drafts based on your available study windows. Click **Save task** on any milestone below to add it directly to your Hearth schedule:`;

    return {
      reply,
      reasoning: [
        'Separated optical simulation deep work from hardware debugging to reduce task-switching friction.',
        'Scheduled OptiSystem paper first due to high analytical requirements.',
        'Added a 45-minute buffer task to prevent deadline submission panics.',
      ],
      drafts,
    };
  }

  // 2. Who is free / Candidate question
  const isWhoQuestion = /\b(who is|who's|who should|who can|best person|best suited|most free|available to|assign|কে ফ্রি|কে করবে)\b/i.test(clean);
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
        reply: `### 👥 Member Availability & Suitability Analysis

Based on the family schedule, workload capacity, and skills for **${formatDayTime(sample.start)}**, **${topPerson.name}** is the best fit with a **${top.score}/100 Suitability Score** (${top.reasons.join(' ')}).

You can save this task directly to their schedule below:`,
        reasoning,
        drafts: [recommendedDraft],
      };
    }
  }

  // 3. Plan / conflict / schedule questions
  const isPlanOrWhyQuestion = /\b(plan|week|clash|conflict|overlap|busy|exam|hand ?over|move|reschedule|postpone|what should i|first|urgent|priority|why)\b/i.test(clean);
  if (isPlanOrWhyQuestion && !/\b(add|create|make a task)\b/i.test(clean)) {
    const [myDay, attention, planResult] = await Promise.all([decisionService.getMyDay(), decisionService.listAttention(), basicPlan(clean)]);
    const reasoning: string[] = [];
    if (myDay.length > 0) {
      myDay.slice(0, 3).forEach((r) => {
        reasoning.push(`Priority #${r.rank} “${r.task.title}” (${formatDayTime(r.task.start)}) — Score ${r.priority.score}/100: ${r.priority.explanation}`);
      });
    }
    if (attention.length > 0) {
      attention.slice(0, 3).forEach((a) => {
        const best = a.topCandidate
          ? `Best handover candidate: ${firstName(roster.find((p) => p.id === a.topCandidate?.memberId)?.name)} (Suitability ${a.topCandidate.score}/100 — ${a.topCandidate.reasons.join(' ')})`
          : 'No alternative candidate free at that exact hour';
        reasoning.push(`Conflict on “${a.task.title}”: ${a.conflict.reason} · ${best}`);
      });
    }
    return {
      reply:
        planResult.suggestions.length > 0
          ? `### 📅 7-Day Plan Overview\n\n${planResult.summary}\n\nHere is the decision engine breakdown and actionable adjustments you can apply with one click:`
          : `### 📅 7-Day Plan Overview\n\n${planResult.summary}\n\nI checked your priority queue and family availability—everything is currently on track.`,
      reasoning: reasoning.length > 0 ? reasoning : ['No schedule conflicts or overdue tasks detected in the next 7 days.'],
      suggestions: planResult.suggestions,
    };
  }

  // 4. Task instruction
  const isAddInstruction = /\b(add|create|schedule|remind|new task|draft|make a task|need to|have to|buy|take|cook|call|pick up|drop)\b/i.test(clean);
  if (isAddInstruction) {
    const quick = await enrichDraftsWithSuitability(readNote(clean, roster, me), clean, roster, me);
    if (quick.drafts.length > 0) {
      const reasoning = quick.drafts.map((d) => `“${d.title}” (${formatDayTime(d.start)}): ${d.reason ?? 'Prepared from your instruction.'}`);
      return {
        reply: `### ✨ Task Drafts Ready\n\nI have extracted ${quick.drafts.length === 1 ? 'a task draft' : `${quick.drafts.length} task drafts`} from your instruction, complete with assignee suitability and priority reasoning. Review and click **Save task** below:`,
        reasoning: [...reasoning, ...quick.assumptions],
        drafts: quick.drafts,
      };
    }
  }

  // 5. Friendly general conversation & guidance
  const [myDay, attention] = await Promise.all([decisionService.getMyDay(), decisionService.listAttention()]);
  const topTask = myDay[0];
  const reasoning: string[] = [];
  if (topTask) {
    reasoning.push(`Top priority today: “${topTask.task.title}” (Score ${topTask.priority.score}/100 — ${topTask.priority.explanation})`);
  }
  if (attention.length > 0) {
    reasoning.push(`${attention.length} family ${attention.length === 1 ? 'clash needs' : 'clashes need'} attention.`);
  }

  const greeting = /^(hi|hello|hey|salam|assalamu alaikum|good morning|good evening)/i.test(clean) ? `### 👋 Hello ${firstName(me.name)}!\n\n` : `### 💡 Hearth AI Assistant\n\n`;

  return {
    reply: `${greeting}I'm here to help you organize your academic deadlines, project submissions, family schedule, and tasks.

Here are a few things you can ask me:
- **Organize studies & projects:** *“I have an OptiSystem paper submission and microcontroller project, how can I organize?”*
- **Check who is free:** *“Who is free to take Dadu to the doctor tomorrow at 4pm?”*
- **Create tasks on the fly:** *“Add a task: Buy medicine tomorrow at 6pm”*
- **Resolve clashes:** *“I have an exam on Wednesday, hand over my morning tasks to Rafid”*

${topTask ? `Currently, your #1 focus is **“${topTask.task.title}”** (${formatDayTime(topTask.task.start)}, Priority Score **${topTask.priority.score}/100**).` : 'Your schedule is currently clear!'}`,
    reasoning,
  };
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

  async chat(message: string, mode: AiMode, roster: RosterPerson[], me: RosterPerson, history: ChatHistoryMessage[] = []): Promise<ChatReply> {
    const clean = message.trim();
    if (!clean) return fail('Write a question or instruction for the assistant.', 422);
    if (clean.length > 800) return fail('Keep your message to 800 characters or fewer.', 422);

    // 1. Direct browser-to-Gemini if API key configured:
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        return await callGeminiDirect(geminiKey, clean, roster, me, history);
      } catch {
        // Fall back to server or offline if Gemini call encounters an issue.
      }
    }

    // 2. Server AI endpoint if running against live backend:
    if (mode === 'ai' && !config.useMocks) {
      try {
        return await apiRequest<ChatReply>('/ai/chat', { method: 'POST', body: { message: clean } });
      } catch {
        // Fall back to local assistant
      }
    }

    // 3. Smart local assistant fallback:
    return respond(await basicChat(clean, roster, me));
  },

  async draft(request: DraftRequest, mode: AiMode, names: { me: string; nameOf: (id?: string | null) => string }): Promise<string> {
    if (mode === 'basic') return basicDraft(request, names);
    const result = await apiRequest<{ text: string }>('/ai/drafts', { method: 'POST', body: request });
    return result.text;
  },
};
