import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Bot, CalendarClock, CheckCircle2, Key, ListStart, MessageSquarePlus, PlusCircle, RefreshCw, Send, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type ChatReply, type PlanResult, type PlanSuggestion, type TaskDraft } from '@/services/ai/aiService';
import type { RosterPerson } from '@/services/ai/localAssistant';
import { decisionService } from '@/services/decision/decisionService';
import { taskService } from '@/services/tasks/taskService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, timeAgo } from '@/lib/dates';
import { useTranslation } from '@/i18n';
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, FormField, Input, ListSkeleton, PageHeader, Textarea, useToast } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { AiConsentCallout } from './AiConsentCallout';
import { MarkdownView } from './MarkdownView';
import { useAiStatus } from './useAiStatus';

const ICONS = { 'do-first': ListStart, move: CalendarClock, 'hand-over': ArrowRightLeft };

const INSTRUCTION_CHIPS = ['Hand over my clashing tasks to the most suitable member', 'Move flexible routine tasks to tomorrow morning', 'I am busy tomorrow afternoon — reassign shared tasks'];

const CHAT_PROMPTS = [
  'I have my OptiSystem paper submission & microcontroller project submission. Tied with other studies how can I organize?',
  'Who is best suited to take Dadu to the dentist tomorrow at 4pm?',
  'What should I focus on first today and why?',
  'Add a task: Buy Dadu’s medicine tomorrow at 6pm',
  'Do we have any schedule clashes this week?',
];

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning?: string[];
  drafts?: TaskDraft[];
  suggestions?: PlanSuggestion[];
  timestamp: string;
}

/**
 * "Plan my week" & AI Assistant Studio:
 * 1. Generate a 7-day plan with optional custom instructions/constraints, with full priority & suitability reasoning.
 * 2. Chat interactively with the AI Assistant to ask who is free, understand task rankings, draft tasks, or adjust the schedule.
 */
export default function PlanPage() {
  useDocumentTitle('Plan my week');
  const { members, me, people, firstNameOf } = useFamily();
  const { mode, status, geminiKey, setGeminiKey, clearGeminiKey, refresh } = useAiStatus();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Plan my week state
  const [instructions, setInstructions] = useState('');
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'applied' | 'dismissed'>>({});
  const [applying, setApplying] = useState<string | null>(null);

  // Interactive AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(geminiKey ?? '');
  const [savedDraftKeys, setSavedDraftKeys] = useState<Record<string, boolean>>({});
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `### 👋 Hi ${me ? firstNameOf(me.id) : 'there'}!

I'm your Hearth AI Assistant, powered by **Google Gemini 2.5 Flash** and live decision scoring.

Ask me anything or try:
- *“I have my OptiSystem paper submission & microcontroller project submission. Tied with other studies how can I organize?”*
- *“Who is free to take Dadu to the doctor tomorrow at 4pm?”*
- *“Add a task: Buy groceries tomorrow at 6pm”*`,
      timestamp: new Date().toISOString(),
    },
  ]);

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

  const suggest = async (customInstructions?: string) => {
    const activeInstructions = customInstructions !== undefined ? customInstructions : instructions;
    setState('loading');
    setError(null);
    try {
      setPlan(await aiService.plan(mode, activeInstructions));
      setDone({});
      setState('idle');
      if (mode === 'ai') void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  const apply = async (s: PlanSuggestion) => {
    if (s.action === 'do-first') {
      setDone((d) => ({ ...d, [s.id]: 'applied' }));
      return;
    }
    setApplying(s.id);
    try {
      await decisionService.applySimulation(s.action === 'move' ? { taskId: s.taskId, start: s.start } : { taskId: s.taskId, assigneeId: s.assigneeId });
      setDone((d) => ({ ...d, [s.id]: 'applied' }));
      toast({ title: 'Plan updated', description: describe(s) });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t apply that change', description: e instanceof Error ? e.message : undefined });
    } finally {
      setApplying(null);
    }
  };

  const sendChat = async (promptText?: string) => {
    const text = (promptText ?? chatInput).trim();
    if (!text || !me || chatLoading) return;
    if (!promptText) setChatInput('');

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setChatLoading(true);

    try {
      const self: RosterPerson = { id: me.id, name: me.name, kind: 'member', takesTasks: me.role !== 'observer', skills: me.skills };
      const history = turns.map((t) => ({ role: t.role, text: t.text }));
      const reply: ChatReply = await aiService.chat(text, mode, roster, self, history);

      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: reply.reply,
        reasoning: reply.reasoning,
        drafts: reply.drafts,
        suggestions: reply.suggestions,
        timestamp: new Date().toISOString(),
      };
      setTurns((prev) => [...prev, assistantTurn]);
      if (mode === 'ai') void refresh();
    } catch (e) {
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: e instanceof Error ? e.message : 'Could not process that instruction right now.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const saveDraftFromChat = async (turnId: string, idx: number, draft: TaskDraft) => {
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
      toast({ title: 'Task added', description: `“${draft.title}” assigned to ${firstNameOf(draft.assigneeId)}.` });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t save task', description: e instanceof Error ? e.message : undefined });
    }
  };

  const saveKey = () => {
    setGeminiKey(keyInput.trim());
    setKeyModalOpen(false);
    toast({
      title: keyInput.trim() ? 'Gemini API Key Connected' : 'Gemini Key Cleared',
      description: keyInput.trim() ? 'Connected directly to Google Gemini 2.5 Flash.' : 'Switched back to local assistant mode.',
    });
  };

  const describe = (s: PlanSuggestion) =>
    s.action === 'move' && s.start ? `Move to ${formatDayTime(s.start)}` : s.action === 'hand-over' ? `Give it to ${firstNameOf(s.assigneeId)}` : 'Do this first';

  const label = { 'do-first': t.ai.doFirst, move: t.ai.move, 'hand-over': t.ai.handOver };

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Next seven days <AiBadge mode={mode} />
          </span>
        }
        title={t.ai.planTitle}
        description={t.ai.planDescription}
        actions={
          <Button
            onClick={() => void suggest()}
            loading={state === 'loading'}
            leftIcon={plan ? <RefreshCw aria-hidden="true" className="h-4 w-4" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
          >
            {plan ? 'Suggest again' : t.ai.suggestPlan}
          </Button>
        }
      />

      <div className="mb-6 space-y-4">
        <AiConsentCallout />
        {mode === 'ai' && status && (
          <p className="text-sm text-ink-muted">
            AI requests today: {status.usedToday} of {status.dailyLimit}.
          </p>
        )}

        {/* Custom Instructions for Weekly Plan */}
        <Card padding="md" className="space-y-3">
          <FormField label="Give instructions or constraints for your week (optional)" hint="Tell Hearth who is busy, which day to clear, or who should take over specific tasks">
            {(field) => (
              <Textarea
                {...field}
                voice
                rows={2}
                maxLength={500}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. I have an exam on Wednesday, hand over my tasks to Rafid; or move routine tasks to tomorrow morning"
              />
            )}
          </FormField>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {INSTRUCTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setInstructions(chip);
                    void suggest(chip);
                  }}
                  className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs text-ink-muted transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                >
                  {chip}
                </button>
              ))}
            </div>
            {instructions.trim() && (
              <Button size="sm" onClick={() => void suggest()} loading={state === 'loading'} leftIcon={<Sparkles aria-hidden="true" className="h-3.5 w-3.5" />}>
                Apply instructions to plan
              </Button>
            )}
          </div>
        </Card>
      </div>

      {state === 'error' ? (
        <ErrorState message={error ?? undefined} onRetry={() => void suggest()} />
      ) : state === 'loading' ? (
        <ListSkeleton rows={3} />
      ) : !plan ? (
        <EmptyState
          icon={<Sparkles aria-hidden="true" />}
          title="Ready when you are"
          description="Hearth looks at your next seven days, your custom instructions, and the family’s clashes, then suggests changes with clear priority and suitability reasoning. Nothing changes until you press Apply."
          action={
            <Button onClick={() => void suggest()} leftIcon={<Sparkles aria-hidden="true" className="h-4 w-4" />}>
              {t.ai.suggestPlan}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <Card tone="primary" padding="md">
            <p className="font-display text-lg text-ink">{plan.summary}</p>
            <p className="mt-1 text-xs text-ink-subtle">Suggested {timeAgo(plan.generatedAt)}</p>
          </Card>
          {plan.suggestions.length === 0 ? (
            <EmptyState icon={<CheckCircle2 aria-hidden="true" />} tone="mint" title="Nothing to change" description="Your week already works. Hearth will flag anything new as it comes up." />
          ) : (
            <ul className="space-y-3">
              {plan.suggestions.map((s) => {
                const Icon = ICONS[s.action];
                const outcome = done[s.id];
                return (
                  <li key={s.id}>
                    <Card padding="md" className={outcome ? 'opacity-70' : undefined}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                          <Icon aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="primary">{label[s.action]}</Badge>
                            <Link to={`/tasks/${s.taskId}`} className="font-semibold text-ink hover:underline">
                              {s.taskTitle}
                            </Link>
                          </div>
                          <p className="mt-1 text-sm font-medium text-ink">{describe(s)}</p>
                          <div className="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink">
                            <span className="font-semibold text-primary-800">Why this was chosen: </span>
                            <span className="text-ink-muted">{s.reason}</span>
                          </div>
                          {s.action !== 'do-first' && (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-mint-700">
                              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                              Checked by the decision engine: fixes {s.resolves} {s.resolves === 1 ? 'clash' : 'clashes'}
                              {s.introduces > 0 ? `, creates ${s.introduces}` : ', creates none'}.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {outcome ? (
                            <Badge tone={outcome === 'applied' ? 'mint' : 'neutral'}>{outcome === 'applied' ? (s.action === 'do-first' ? 'Noted' : 'Applied') : 'Dismissed'}</Badge>
                          ) : (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setDone((d) => ({ ...d, [s.id]: 'dismissed' }))}>
                                {t.ai.dismiss}
                              </Button>
                              <Button size="sm" onClick={() => void apply(s)} loading={applying === s.id}>
                                {s.action === 'do-first' ? 'OK' : t.ai.apply}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Interactive Chat with AI Assistant */}
      <section aria-labelledby="ai-chat-heading" className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <MessageSquarePlus aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 id="ai-chat-heading" className="font-display text-lg font-semibold text-ink">
                Chat &amp; give instructions to AI Assistant
              </h2>
              <p className="text-xs text-ink-muted">Ask who is free, organize academic workloads, or instruct the assistant to create and reschedule tasks.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setKeyInput(geminiKey ?? '');
                setKeyModalOpen(true);
              }}
              leftIcon={<Key aria-hidden="true" className="h-3.5 w-3.5" />}
            >
              {geminiKey ? 'Gemini: Active' : 'Gemini Key'}
            </Button>
            <AiBadge mode={mode} />
          </div>
        </div>

        <Card padding="md" className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {CHAT_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendChat(prompt)}
                disabled={chatLoading}
                className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs text-ink-muted transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="max-h-[500px] space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface-muted/40 p-3 sm:p-4">
            {turns.map((turn) => (
              <div key={turn.id} className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${turn.role === 'user' ? 'bg-primary-600 text-white' : 'border border-line bg-surface text-ink shadow-xs'}`}>
                  <div className="mb-1 flex items-center gap-2 text-xs opacity-75">
                    {turn.role === 'assistant' && <Bot aria-hidden="true" className="h-3.5 w-3.5 text-primary-700" />}
                    <span className="font-medium">{turn.role === 'user' ? 'You' : 'Hearth Assistant'}</span>
                  </div>

                  {turn.role === 'assistant' ? <MarkdownView content={turn.text} /> : <p className="whitespace-pre-wrap">{turn.text}</p>}

                  {turn.reasoning && turn.reasoning.length > 0 && (
                    <div className="mt-3 rounded-xl bg-primary-50/70 p-2.5 text-xs text-ink">
                      <p className="font-semibold text-primary-800">Decision &amp; suitability reasoning:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
                        {turn.reasoning.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {turn.drafts && turn.drafts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {turn.drafts.map((d, idx) => {
                        const key = `${turn.id}-${idx}`;
                        const saved = Boolean(savedDraftKeys[key]);
                        return (
                          <div key={key} className="flex flex-col justify-between gap-2 rounded-xl border border-line bg-surface-muted/60 p-3 sm:flex-row sm:items-center">
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">{d.title}</p>
                              <p className="text-xs text-ink-muted">
                                {formatDayTime(d.start)} · {d.durationMin} min · Assigned to <span className="font-medium text-ink">{firstNameOf(d.assigneeId)}</span>
                              </p>
                              {d.reason && <p className="mt-1 text-xs text-primary-800">{d.reason}</p>}
                            </div>
                            <Button
                              size="sm"
                              variant={saved ? 'secondary' : 'primary'}
                              disabled={saved}
                              leftIcon={saved ? <UserCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <PlusCircle aria-hidden="true" className="h-3.5 w-3.5" />}
                              onClick={() => void saveDraftFromChat(turn.id, idx, d)}
                            >
                              {saved ? 'Saved' : 'Save task'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {turn.suggestions && turn.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {turn.suggestions.map((s) => {
                        const outcome = done[s.id];
                        return (
                          <div key={s.id} className="flex flex-col justify-between gap-2 rounded-xl border border-line bg-surface-muted/60 p-3 sm:flex-row sm:items-center">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge tone="primary">{label[s.action]}</Badge>
                                <span className="font-semibold text-ink">{s.taskTitle}</span>
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-ink">{describe(s)}</p>
                              <p className="mt-0.5 text-xs text-ink-muted">{s.reason}</p>
                            </div>
                            <Button size="sm" variant={outcome === 'applied' ? 'secondary' : 'primary'} disabled={Boolean(outcome)} loading={applying === s.id} onClick={() => void apply(s)}>
                              {outcome === 'applied' ? 'Applied' : s.action === 'do-first' ? 'Noted' : t.ai.apply}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-xs text-ink-muted shadow-2xs">
                <Sparkles aria-hidden="true" className="h-4 w-4 animate-spin text-primary-600" />
                <span>Thinking...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat();
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="flex-1">
              <Input
                aria-label="Ask or instruct the AI assistant"
                value={chatInput}
                maxLength={800}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask anything (e.g. “I have an OptiSystem paper and microcontroller project, how can I organize?”)"
              />
            </div>
            <Button type="submit" loading={chatLoading} disabled={!chatInput.trim()} leftIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
              Send
            </Button>
          </form>
        </Card>
      </section>

      {/* Gemini API Key Dialog */}
      <Dialog
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        size="md"
        title="Google Gemini 2.5 Flash API Key"
        description="Connect your Gemini API key from Google AI Studio. It is stored securely in your browser's localStorage and enables direct real-time Gemini chat."
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
            <p className="font-semibold text-primary-900">Why connect a Gemini API key?</p>
            <p className="mt-1 text-ink-muted">
              Google AI Studio provides a free tier for Gemini 2.5 Flash. Adding your key gives you direct, full conversational intelligence for study planning, project breakdown, and family
              scheduling without needing a server.
            </p>
          </div>
        </div>
      </Dialog>
    </>
  );
}
