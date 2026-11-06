import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  GraduationCap,
  Key,
  MessageSquare,
  PanelLeft,
  Plus,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type ChatReply, type LiveContextSnapshot, type PlanSuggestion, type TaskDraft } from '@/services/ai/aiService';
import type { RosterPerson } from '@/services/ai/localAssistant';
import { decisionService } from '@/services/decision/decisionService';
import { taskService } from '@/services/tasks/taskService';
import { formatDayTime } from '@/lib/dates';
import { Badge, Button, Dialog, FormField, Input, useToast } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { MarkdownView } from './MarkdownView';
import { useAiStatus } from './useAiStatus';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning?: string[];
  drafts?: TaskDraft[];
  suggestions?: PlanSuggestion[];
  followUps?: string[];
  timestamp: string;
}

interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  turns: ChatTurn[];
}

const THREADS_STORAGE_KEY = 'hearth.ai.chat.threads.v1';

const STARTER_CARDS = [
  {
    icon: CalendarClock,
    badge: 'Daily Timetable',
    title: 'Make me a routine',
    prompt: 'Make me a routine around my classes and tasks',
    description: 'Builds an hour-by-hour schedule using your real open windows today & tomorrow.',
  },
  {
    icon: GraduationCap,
    badge: 'Academic & Projects',
    title: 'Organize study & project submissions',
    prompt: 'I have my OptiSystem paper submission & microcontroller project submission. Tied with other studies how can I organize?',
    description: 'Breaks down papers, labs, and coursework into conflict-free focus blocks.',
  },
  {
    icon: Users,
    badge: 'Family Suitability',
    title: 'Find who is best suited for a task',
    prompt: 'Who is best suited to take Dadu to the dentist tomorrow at 4pm?',
    description: 'Checks every family member’s availability, skills, and fairness score.',
  },
  {
    icon: Zap,
    badge: 'Clash Resolution',
    title: 'Check & resolve schedule clashes',
    prompt: 'Do we have any schedule clashes this week and how should we fix them?',
    description: 'Finds overlapping tasks and recommends 1-click handovers or time shifts.',
  },
];

function loadSavedThreads(): ChatThread[] {
  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatThread[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return [];
  }
}

function saveThreads(threads: ChatThread[]) {
  try {
    window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads.slice(0, 20)));
  } catch {
    // Ignore storage quota errors
  }
}

function createFreshThread(): ChatThread {
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'New conversation',
    updatedAt: new Date().toISOString(),
    turns: [],
  };
}

/**
 * Full ChatGPT / Google Gemini conversational interface for Hearth.
 * Includes thread history sidebar, live Hearth schedule grounding, collapsible reasoning drawers,
 * Markdown tables, 1-click task saving & conflict resolution, and a multi-line Enter-to-send composer.
 */
export function GeminiChatStudio({ compact = false }: { compact?: boolean }) {
  const { members, me, people, firstNameOf } = useFamily();
  const { mode, geminiKey, setGeminiKey, clearGeminiKey, refresh } = useAiStatus();
  const { toast } = useToast();

  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const loaded = loadSavedThreads();
    return loaded.length > 0 ? loaded : [createFreshThread()];
  });
  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id ?? '');
  const [sidebarOpen, setSidebarOpen] = useState(!compact);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(geminiKey ?? '');
  const [savedDraftKeys, setSavedDraftKeys] = useState<Record<string, boolean>>({});
  const [appliedSuggestions, setAppliedSuggestions] = useState<Record<string, boolean>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<LiveContextSnapshot | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeThread = useMemo(() => threads.find((t) => t.id === activeThreadId) ?? threads[0], [threads, activeThreadId]);
  const turns = activeThread?.turns ?? [];

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  useEffect(() => {
    if (!me) return;
    void aiService
      .getLiveContextSnapshot(me.id)
      .then(setLiveSnapshot)
      .catch(() => null);
  }, [me, turns.length]);

  useEffect(() => {
    if (turns.length > 0 || loading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [turns.length, loading]);

  const takers = useMemo(() => members.filter((m) => m.status === 'active' && m.role !== 'observer'), [members]);
  const roster: RosterPerson[] = useMemo(
    () =>
      people.map((p) => {
        const member = takers.find((m) => m.id === p.id);
        return {
          id: p.id,
          name: p.name,
          kind: p.kind,
          takesTasks: p.kind === 'member' && Boolean(member),
          skills: member?.skills,
        };
      }),
    [people, takers],
  );

  const updateActiveThread = (updater: (thread: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === activeThread.id ? updater(t) : t)));
  };

  const startNewChat = () => {
    // If current thread is already empty, just focus input
    if (activeThread && activeThread.turns.length === 0) {
      textareaRef.current?.focus();
      return;
    }
    const fresh = createFreshThread();
    setThreads((prev) => [fresh, ...prev]);
    setActiveThreadId(fresh.id);
    setInput('');
    textareaRef.current?.focus();
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const fresh = createFreshThread();
        setActiveThreadId(fresh.id);
        return [fresh];
      }
      if (id === activeThread.id) {
        setActiveThreadId(remaining[0].id);
      }
      return remaining;
    });
  };

  const sendMessage = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || !me || loading) return;
    if (!promptText) {
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const historyForCall = turns.map((t) => ({ role: t.role, text: t.text }));

    updateActiveThread((thread) => {
      const nextTurns = [...thread.turns, userTurn];
      const nextTitle = thread.turns.length === 0 ? (text.length > 42 ? `${text.slice(0, 42)}…` : text) : thread.title;
      return {
        ...thread,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
        turns: nextTurns,
      };
    });

    setLoading(true);
    try {
      const self: RosterPerson = {
        id: me.id,
        name: me.name,
        kind: 'member',
        takesTasks: me.role !== 'observer',
        skills: me.skills,
      };
      const reply: ChatReply = await aiService.chat(text, mode, roster, self, historyForCall);

      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: reply.reply,
        reasoning: reply.reasoning,
        drafts: reply.drafts,
        suggestions: reply.suggestions,
        followUps: reply.followUps,
        timestamp: new Date().toISOString(),
      };

      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        turns: [...thread.turns, assistantTurn],
      }));
      if (mode === 'ai') void refresh();
    } catch (e) {
      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        turns: [
          ...thread.turns,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: e instanceof Error ? e.message : 'Could not process that question right now.',
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  const regenerateLastResponse = async () => {
    if (loading || turns.length === 0) return;
    const lastUserIdx = [...turns].map((t) => t.role).lastIndexOf('user');
    if (lastUserIdx < 0) return;
    const lastUserPrompt = turns[lastUserIdx].text;
    const priorTurns = turns.slice(0, lastUserIdx);
    updateActiveThread((thread) => ({
      ...thread,
      turns: priorTurns,
    }));
    await sendMessage(lastUserPrompt);
  };

  const saveDraft = async (turnId: string, idx: number, draft: TaskDraft) => {
    const key = `${turnId}-${idx}`;
    if (savedDraftKeys[key]) return;
    try {
      await taskService.createTask({
        title: draft.title,
        notes: draft.notes ?? '',
        category: draft.category,
        priority: draft.priority,
        start: draft.start,
        durationMin: draft.durationMin,
        assigneeId: draft.assigneeId,
        forId: draft.forId,
        visibility: draft.visibility,
        reminder: draft.reminder,
      });
      setSavedDraftKeys((prev) => ({ ...prev, [key]: true }));
      toast({
        title: 'Added to schedule',
        description: `“${draft.title}” saved for ${firstNameOf(draft.assigneeId)} (${formatDayTime(draft.start)}).`,
      });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t save task', description: e instanceof Error ? e.message : undefined });
    }
  };

  const saveAllDrafts = async (turnId: string, drafts: TaskDraft[]) => {
    for (let idx = 0; idx < drafts.length; idx++) {
      const key = `${turnId}-${idx}`;
      if (!savedDraftKeys[key]) {
        await saveDraft(turnId, idx, drafts[idx]);
      }
    }
  };

  const applySuggestion = async (s: PlanSuggestion) => {
    if (!me || appliedSuggestions[s.id]) return;
    if (s.action === 'do-first') {
      setAppliedSuggestions((prev) => ({ ...prev, [s.id]: true }));
      return;
    }
    setApplyingId(s.id);
    try {
      await decisionService.applySimulation(s.action === 'move' ? { taskId: s.taskId, start: s.start } : { taskId: s.taskId, assigneeId: s.assigneeId });
      setAppliedSuggestions((prev) => ({ ...prev, [s.id]: true }));
      toast({
        title: 'Schedule updated',
        description: s.action === 'move' && s.start ? `Moved “${s.taskTitle}” to ${formatDayTime(s.start)}.` : `Handed over “${s.taskTitle}” to ${firstNameOf(s.assigneeId)}.`,
      });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t apply change', description: e instanceof Error ? e.message : undefined });
    } finally {
      setApplyingId(null);
    }
  };

  const copyTurnText = async (turn: ChatTurn) => {
    try {
      await navigator.clipboard.writeText(turn.text);
      setCopiedTurnId(turn.id);
      setTimeout(() => setCopiedTurnId((prev) => (prev === turn.id ? null : prev)), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const saveKey = () => {
    setGeminiKey(keyInput.trim());
    setKeyModalOpen(false);
    toast({
      title: keyInput.trim() ? 'Gemini API Key Connected' : 'Gemini Key Cleared',
      description: keyInput.trim() ? 'Connected directly to Google Gemini 2.5 Flash.' : 'Using Hearth’s built-in schedule-aware AI engine.',
    });
  };

  const userFirstName = me?.name ? me.name.split(' ')[0] : 'there';

  return (
    <>
      <div className="flex min-h-[680px] overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        {/* Left Sidebar — ChatGPT / Gemini Thread History & Live Schedule Context */}
        {sidebarOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface-muted/40">
            <div className="p-3">
              <button
                type="button"
                onClick={startNewChat}
                className="flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm font-semibold text-ink shadow-2xs transition hover:border-primary-300 hover:bg-primary-50/60"
              >
                <Plus aria-hidden="true" className="h-4 w-4 text-primary-600" />
                <span>New chat</span>
              </button>
            </div>

            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Recent conversations</div>

            <div className="flex-1 space-y-1 overflow-y-auto px-2 py-1">
              {threads.map((thread) => {
                const active = thread.id === activeThread.id;
                return (
                  <div
                    key={thread.id}
                    className={`group flex items-center justify-between gap-1 rounded-xl px-3 py-2 text-xs transition ${
                      active ? 'bg-primary-100/80 font-semibold text-primary-950' : 'text-ink-muted hover:bg-surface hover:text-ink'
                    }`}
                  >
                    <button type="button" onClick={() => setActiveThreadId(thread.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{thread.title}</span>
                    </button>
                    {threads.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteThread(thread.id)}
                        title="Delete conversation"
                        aria-label={`Delete conversation ${thread.title}`}
                        className="rounded-lg p-1 text-ink-muted opacity-0 transition hover:bg-surface-muted hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live Hearth Schedule Grounding Indicator */}
            {liveSnapshot && (
              <div className="m-3 rounded-2xl border border-line bg-surface p-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Live Schedule Connected</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Today: <strong className="text-ink">{liveSnapshot.todayClassesCount} classes</strong>, <strong className="text-ink">{liveSnapshot.todayTasksCount} tasks</strong>, and{' '}
                  <strong className="text-ink">{Math.round((liveSnapshot.todayFreeMinutes / 60) * 10) / 10} hrs free</strong> across {liveSnapshot.todayFreeWindowsCount} open windows.
                </p>
                {liveSnapshot.clashCount > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    ⚡ {liveSnapshot.clashCount} family clash{liveSnapshot.clashCount === 1 ? '' : 'es'} ready to resolve
                  </p>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Main ChatGPT / Gemini Conversational Viewport */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          {/* Top Model & Action Bar */}
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="rounded-xl border border-line p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                title={sidebarOpen ? 'Hide chat history' : 'Show chat history'}
                aria-label={sidebarOpen ? 'Hide chat history' : 'Show chat history'}
              >
                <PanelLeft aria-hidden="true" className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 rounded-2xl bg-surface-muted/70 px-3 py-1.5">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-primary-600" />
                <span className="text-sm font-semibold text-ink">Hearth Gemini 2.5</span>
                <AiBadge mode={mode} />
              </div>

              {liveSnapshot && (
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-medium text-emerald-900 md:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Synced with your classes &amp; tasks
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void sendMessage('Make me a routine around my classes and tasks')}
                disabled={loading}
                leftIcon={<CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                Make me a routine
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setKeyInput(geminiKey ?? '');
                  setKeyModalOpen(true);
                }}
                leftIcon={<Key aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                {geminiKey ? 'Gemini Key: Active' : 'API Key'}
              </Button>
              {turns.length > 0 && (
                <Button variant="secondary" size="sm" onClick={startNewChat} leftIcon={<Plus aria-hidden="true" className="h-3.5 w-3.5" />}>
                  New chat
                </Button>
              )}
            </div>
          </header>

          {/* Message Stream or Centered Empty-State Welcome Hero */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {turns.length === 0 ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 shadow-xs">
                  <Sparkles aria-hidden="true" className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Hello, {userFirstName}. How can I help you today?</h2>
                <p className="mt-2 max-w-xl text-sm text-ink-muted">
                  Chat with me just like Gemini or ChatGPT. I already know your live Hearth classes, tasks, free windows, and family schedule—ask me to build a routine, organize your submissions, or
                  coordinate tasks.
                </p>

                {/* 2x2 Starter Cards Grid (ChatGPT / Gemini style) */}
                <div className="mt-7 grid w-full gap-3 sm:grid-cols-2 text-left">
                  {STARTER_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.title}
                        type="button"
                        disabled={loading}
                        onClick={() => void sendMessage(card.prompt)}
                        className="group flex flex-col justify-between rounded-2xl border border-line bg-surface-muted/35 p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/40 hover:shadow-xs disabled:opacity-50"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-primary-900">
                              <Icon aria-hidden="true" className="h-3 w-3" />
                              {card.badge}
                            </span>
                            <ArrowUp aria-hidden="true" className="h-4 w-4 rotate-45 text-ink-muted opacity-0 transition group-hover:opacity-100" />
                          </div>
                          <p className="mt-2.5 font-semibold text-ink group-hover:text-primary-900">{card.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{card.description}</p>
                        </div>
                        <p className="mt-3 truncate text-[11px] font-medium text-primary-700">“{card.prompt}”</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {turns.map((turn, turnIdx) => {
                  const isLastAssistant = turn.role === 'assistant' && turnIdx === turns.length - 1;
                  const reasoningOpen = Boolean(expandedReasoning[turn.id]);
                  const allDraftsSaved = turn.drafts && turn.drafts.length > 0 && turn.drafts.every((_, idx) => Boolean(savedDraftKeys[`${turn.id}-${idx}`]));

                  if (turn.role === 'user') {
                    return (
                      <div key={turn.id} className="flex justify-end">
                        <div className="max-w-xl rounded-3xl rounded-br-md bg-primary-600 px-5 py-3.5 text-sm leading-relaxed text-white shadow-xs">
                          <p className="whitespace-pre-wrap">{turn.text}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={turn.id} className="flex items-start gap-3.5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 shadow-2xs">
                        <Bot aria-hidden="true" className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-ink">Hearth AI</span>
                          <span className="text-[11px] text-ink-muted">· Grounded in your live schedule</span>

                          {/* Gemini-style "Show schedule reasoning" toggle */}
                          {turn.reasoning && turn.reasoning.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedReasoning((prev) => ({ ...prev, [turn.id]: !prev[turn.id] }))}
                              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted/70 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-primary-300 hover:text-primary-800"
                            >
                              {reasoningOpen ? <ChevronDown aria-hidden="true" className="h-3 w-3" /> : <ChevronRight aria-hidden="true" className="h-3 w-3" />}
                              <span>{reasoningOpen ? 'Hide schedule & suitability reasoning' : `View schedule reasoning (${turn.reasoning.length} checks)`}</span>
                            </button>
                          )}
                        </div>

                        {reasoningOpen && turn.reasoning && turn.reasoning.length > 0 && (
                          <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-3.5 text-xs text-ink">
                            <p className="font-semibold text-primary-900">Decision &amp; Suitability Engine Checks:</p>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink-muted">
                              {turn.reasoning.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Main Formatted Markdown Response */}
                        <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-2xs sm:px-5 sm:py-4">
                          <MarkdownView content={turn.text} />
                        </div>

                        {/* 1-Click Savable Routine / Task Blocks */}
                        {turn.drafts && turn.drafts.length > 0 && (
                          <div className="rounded-2xl border border-line bg-surface-muted/40 p-3.5 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-ink">📅 Ready-to-Save Schedule Blocks ({turn.drafts.length})</span>
                              {turn.drafts.length > 1 && (
                                <Button
                                  size="sm"
                                  variant={allDraftsSaved ? 'secondary' : 'primary'}
                                  disabled={Boolean(allDraftsSaved)}
                                  leftIcon={allDraftsSaved ? <UserCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <PlusCircle aria-hidden="true" className="h-3.5 w-3.5" />}
                                  onClick={() => void saveAllDrafts(turn.id, turn.drafts!)}
                                >
                                  {allDraftsSaved ? 'All saved to schedule' : 'Save all to schedule'}
                                </Button>
                              )}
                            </div>

                            <div className="space-y-2">
                              {turn.drafts.map((d, idx) => {
                                const key = `${turn.id}-${idx}`;
                                const saved = Boolean(savedDraftKeys[key]);
                                return (
                                  <div key={key} className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center shadow-2xs">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone="primary">{d.category}</Badge>
                                        <Badge tone={d.priority === 'urgent' ? 'red' : d.priority === 'important' ? 'amber' : 'neutral'}>{d.priority}</Badge>
                                        <span className="font-semibold text-sm text-ink">{d.title}</span>
                                      </div>
                                      <p className="mt-1 text-xs text-ink-muted">
                                        {formatDayTime(d.start)} · {d.durationMin} min · Assigned to <span className="font-medium text-ink">{firstNameOf(d.assigneeId)}</span>
                                      </p>
                                      {d.reason && <p className="mt-1 text-xs text-primary-800">{d.reason}</p>}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant={saved ? 'secondary' : 'primary'}
                                      disabled={saved}
                                      leftIcon={saved ? <UserCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <PlusCircle aria-hidden="true" className="h-3.5 w-3.5" />}
                                      onClick={() => void saveDraft(turn.id, idx, d)}
                                    >
                                      {saved ? 'Saved' : 'Save task'}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 1-Click Schedule Optimization / Clash Relief Cards */}
                        {turn.suggestions && turn.suggestions.length > 0 && (
                          <div className="rounded-2xl border border-line bg-surface-muted/40 p-3.5 space-y-2">
                            <p className="text-xs font-semibold text-ink">⚡ Recommended Schedule Optimizations ({turn.suggestions.length})</p>
                            {turn.suggestions.map((s) => {
                              const applied = Boolean(appliedSuggestions[s.id]);
                              return (
                                <div key={s.id} className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center shadow-2xs">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge tone="primary">{s.action === 'move' ? 'Move time' : s.action === 'hand-over' ? 'Hand over' : 'Priority #1'}</Badge>
                                      <span className="font-semibold text-sm text-ink">{s.taskTitle}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-ink-muted">{s.reason}</p>
                                  </div>
                                  <Button size="sm" variant={applied ? 'secondary' : 'primary'} disabled={applied} loading={applyingId === s.id} onClick={() => void applySuggestion(s)}>
                                    {applied ? 'Applied' : s.action === 'do-first' ? 'Got it' : 'Apply'}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Message Action Bar (Copy & Regenerate — ChatGPT / Gemini style) */}
                        <div className="flex items-center gap-2 pt-0.5 text-xs text-ink-muted">
                          <button
                            type="button"
                            onClick={() => void copyTurnText(turn)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-surface-muted hover:text-ink"
                            title="Copy response"
                          >
                            {copiedTurnId === turn.id ? (
                              <>
                                <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {isLastAssistant && (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => void regenerateLastResponse()}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-surface-muted hover:text-ink disabled:opacity-50"
                              title="Regenerate response"
                            >
                              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Regenerate</span>
                            </button>
                          )}
                        </div>

                        {/* Contextual Follow-Up Chips (shown below the latest assistant message) */}
                        {isLastAssistant && turn.followUps && turn.followUps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {turn.followUps.map((fPrompt) => (
                              <button
                                key={fPrompt}
                                type="button"
                                disabled={loading}
                                onClick={() => void sendMessage(fPrompt)}
                                className="rounded-full border border-line bg-surface-muted/60 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-900 disabled:opacity-50"
                              >
                                {fPrompt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <Sparkles aria-hidden="true" className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-ink-muted shadow-2xs">Analyzing your Hearth schedule and generating response…</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Sticky Bottom Composer (ChatGPT / Google Gemini Rounded Multi-Line Box) */}
          <div className="border-t border-line bg-surface/95 px-4 py-3.5 sm:px-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="mx-auto max-w-3xl"
            >
              <div className="rounded-3xl border border-line bg-surface-muted/35 p-3 shadow-xs transition focus-within:border-primary-400 focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary-100">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  aria-label="Ask or instruct Hearth AI"
                  value={input}
                  maxLength={800}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Message Hearth AI… (e.g. “Make me a routine”, “I have my OptiSystem paper & microcontroller project, how can I organize?”)"
                  className="w-full resize-none border-0 bg-transparent px-1 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void sendMessage('Make me a routine around my classes and tasks')}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-primary-300 hover:text-primary-800 disabled:opacity-50"
                    >
                      📅 Make me a routine
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void sendMessage('I have my OptiSystem paper submission & microcontroller project submission. Tied with other studies how can I organize?')}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-primary-300 hover:text-primary-800 disabled:opacity-50"
                    >
                      🎓 Study &amp; project plan
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void sendMessage('Do we have any schedule clashes this week?')}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-primary-300 hover:text-primary-800 disabled:opacity-50"
                    >
                      ⚡ Check clashes
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="hidden text-[11px] text-ink-muted sm:inline">Enter to send · Shift+Enter for new line</span>
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      aria-label="Send message"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white shadow-xs transition hover:bg-primary-700 disabled:bg-surface-muted disabled:text-ink-muted"
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Gemini API Key Modal */}
      <Dialog
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        size="md"
        title="Google Gemini 2.5 Flash API Key"
        description="Connect your Gemini API key from Google AI Studio. It is stored in your browser's localStorage and enables live Gemini 2.5 Flash calls grounded in your Hearth schedule."
        footer={
          <>
            {geminiKey && (
              <Button
                variant="secondary"
                onClick={() => {
                  clearGeminiKey();
                  setKeyInput('');
                  setKeyModalOpen(false);
                  toast({ title: 'Gemini Key Cleared' });
                }}
              >
                Clear key
              </Button>
            )}
            <Button variant="secondary" onClick={() => setKeyModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveKey}>Save API Key</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Gemini API Key" hint="Get a free key in 10 seconds at aistudio.google.com">
            {(field) => <Input {...field} type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="AIzaSy..." />}
          </FormField>
          <div className="rounded-xl bg-primary-50/70 p-3 text-xs text-ink">
            <p className="font-semibold text-primary-900">Works out-of-the-box + Optional Live Gemini Key</p>
            <p className="mt-1 text-ink-muted">
              Hearth’s built-in Schedule &amp; Decision Engine already builds personalized routines, resolves clashes, and calculates suitability scores offline. Adding a Google AI Studio key connects
              your chat directly to Gemini 2.5 Flash with your full Hearth schedule injected into the system prompt.
            </p>
          </div>
        </div>
      </Dialog>
    </>
  );
}
