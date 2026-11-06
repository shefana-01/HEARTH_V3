import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, CalendarClock, CheckCircle2, ListStart, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type PlanResult, type PlanSuggestion } from '@/services/ai/aiService';
import { decisionService } from '@/services/decision/decisionService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, timeAgo } from '@/lib/dates';
import { useTranslation } from '@/i18n';
import { Badge, Button, Card, EmptyState, ErrorState, FormField, ListSkeleton, PageHeader, Textarea, useToast } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { AiConsentCallout } from './AiConsentCallout';
import { GeminiChatStudio } from './GeminiChatStudio';
import { useAiStatus } from './useAiStatus';

const ICONS = { 'do-first': ListStart, move: CalendarClock, 'hand-over': ArrowRightLeft };

const INSTRUCTION_CHIPS = ['Hand over my clashing tasks to the most suitable member', 'Move flexible routine tasks to tomorrow morning', 'I am busy tomorrow afternoon — reassign shared tasks'];

/**
 * "Plan my week" & AI Assistant Studio:
 * 1. Chat interactively with the Gemini / ChatGPT-style Hearth AI Studio (build routines, organize studies, check suitability).
 * 2. Generate a 7-day automated family conflict & priority plan with custom instructions.
 */
export default function PlanPage() {
  useDocumentTitle('Plan my week');
  const { firstNameOf } = useFamily();
  const { mode, status, refresh } = useAiStatus();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Plan my week state
  const [instructions, setInstructions] = useState('');
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'applied' | 'dismissed'>>({});
  const [applying, setApplying] = useState<string | null>(null);

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

      {/* Full Gemini / ChatGPT-style Conversational AI Studio */}
      <section aria-label="Hearth AI Chat Studio" className="mb-8">
        <GeminiChatStudio />
      </section>

      {/* 7-Day Automated Conflict & Priority Planner */}
      <section aria-labelledby="weekly-auto-planner" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="weekly-auto-planner" className="font-display text-lg font-semibold text-ink">
              7-Day Automated Clash &amp; Priority Audit
            </h2>
            <p className="text-xs text-ink-muted">Scan the next 7 days for family schedule overlaps and generate 1-click handover or reschedule recommendations.</p>
          </div>
        </div>

        <AiConsentCallout />
        {mode === 'ai' && status && (
          <p className="text-sm text-ink-muted">
            AI requests today: {status.usedToday} of {status.dailyLimit}.
          </p>
        )}

        <Card padding="md" className="space-y-3">
          <FormField label="Give instructions or constraints for your 7-day scan (optional)" hint="Tell Hearth who is busy, which day to clear, or who should take over specific tasks">
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
      </section>
    </>
  );
}
