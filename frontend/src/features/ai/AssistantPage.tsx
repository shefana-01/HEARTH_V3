import { useMemo, useState } from 'react';
import { Bot, Key, PlusCircle, RotateCcw, Send, Sparkles, UserCheck } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type ChatReply, type TaskDraft } from '@/services/ai/aiService';
import type { RosterPerson } from '@/services/ai/localAssistant';
import { taskService } from '@/services/tasks/taskService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime } from '@/lib/dates';
import { Badge, Button, Card, Dialog, FormField, Input, PageHeader, useToast } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { MarkdownView } from './MarkdownView';
import { useAiStatus } from './useAiStatus';

const SUGGESTED_PROMPTS = [
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
  timestamp: string;
}

/**
 * Dedicated Google Gemini AI Assistant Studio for Hearth.
 * Full conversational chat interface powered by Gemini 2.5 Flash + Hearth's live decision engine.
 */
export default function AssistantPage() {
  useDocumentTitle('AI Assistant');
  const { members, me, people, firstNameOf } = useFamily();
  const { mode, geminiKey, setGeminiKey, clearGeminiKey, refresh } = useAiStatus();
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(geminiKey ?? '');
  const [savedDraftKeys, setSavedDraftKeys] = useState<Record<string, boolean>>({});

  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `### 👋 Welcome to your Hearth AI Assistant!

I'm powered by **Google Gemini 2.5 Flash** and integrated directly with Hearth's live family and personal decision engine.

You can talk with me just like you chat with an advanced AI:
- **Organize academic workloads & projects:** Ask how to balance submissions, lab work, and exams.
- **Ask who is best suited for a task:** I check family availability windows, skills, and workload capacity.
- **Instruct me to schedule or adjust tasks:** Type your instructions naturally, and I'll generate 1-click actionable tasks for your schedule.

Try one of the suggested prompts above or type any question below!`,
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

  const sendMessage = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || !me || loading) return;
    if (!promptText) setInput('');

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setLoading(true);

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
          text: e instanceof Error ? e.message : 'Could not process that question right now.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
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
      toast({ title: 'Task added', description: `“${draft.title}” saved to schedule for ${firstNameOf(draft.assigneeId)}.` });
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

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary-600" />
            Conversational Intelligence
            <AiBadge mode={mode} />
          </span>
        }
        title="AI Assistant"
        description="Plan your studies, organize project submissions, coordinate with family, and ask questions with full contextual reasoning."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setKeyInput(geminiKey ?? '');
                setKeyModalOpen(true);
              }}
              leftIcon={<Key aria-hidden="true" className="h-4 w-4" />}
            >
              {geminiKey ? 'Gemini Key: Active' : 'Connect Gemini API Key'}
            </Button>
            {turns.length > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setTurns([turns[0]])} leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />} title="Clear conversation">
                Clear chat
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4">
        {/* Suggested Quick Prompt Chips */}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              disabled={loading}
              className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-xs text-ink-muted transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Messages Log */}
        <Card padding="md" className="space-y-4">
          <div className="min-h-[420px] max-h-[600px] space-y-4 overflow-y-auto rounded-2xl border border-line bg-surface-muted/30 p-3 sm:p-5">
            {turns.map((turn) => (
              <div key={turn.id} className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-3xl rounded-2xl px-4 py-3 sm:px-5 sm:py-4 ${turn.role === 'user' ? 'bg-primary-600 text-white shadow-sm' : 'border border-line bg-surface text-ink shadow-xs'}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs opacity-75">
                    {turn.role === 'assistant' ? (
                      <>
                        <Bot aria-hidden="true" className="h-4 w-4 text-primary-700" />
                        <span className="font-semibold text-primary-800">Hearth Assistant (Gemini)</span>
                      </>
                    ) : (
                      <span className="font-medium">You</span>
                    )}
                  </div>

                  {turn.role === 'assistant' ? <MarkdownView content={turn.text} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>}

                  {turn.reasoning && turn.reasoning.length > 0 && (
                    <div className="mt-3 rounded-xl bg-primary-50/70 p-3 text-xs text-ink">
                      <p className="font-semibold text-primary-900">Decision &amp; suitability insights:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
                        {turn.reasoning.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {turn.drafts && turn.drafts.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-primary-900">Suggested Action Milestones:</p>
                      {turn.drafts.map((d, idx) => {
                        const key = `${turn.id}-${idx}`;
                        const saved = Boolean(savedDraftKeys[key]);
                        return (
                          <div key={key} className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 sm:flex-row sm:items-center shadow-2xs">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge tone="primary">{d.category}</Badge>
                                <Badge tone={d.priority === 'urgent' ? 'red' : d.priority === 'important' ? 'amber' : 'neutral'}>{d.priority}</Badge>
                                <span className="font-semibold text-ink">{d.title}</span>
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
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-xs text-ink-muted shadow-xs">
                <Sparkles aria-hidden="true" className="h-4 w-4 animate-spin text-primary-600" />
                <span>Thinking with Gemini...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="flex-1">
              <Input
                aria-label="Ask or instruct the AI assistant"
                value={input}
                maxLength={800}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything (e.g. “I have an OptiSystem paper and microcontroller project, how can I organize?”)"
              />
            </div>
            <Button type="submit" loading={loading} disabled={!input.trim()} leftIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
              Send
            </Button>
          </form>
        </Card>
      </div>

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
