import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, CalendarClock, CheckCircle2, ListStart, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { aiService, type PlanResult, type PlanSuggestion } from '@/services/ai/aiService';
import { decisionService } from '@/services/decision/decisionService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDayTime, timeAgo } from '@/lib/dates';
import { useTranslation } from '@/i18n';
import { Badge, Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, useToast } from '@/components/ui';
import { AiBadge } from './AiBadge';
import { AiConsentCallout } from './AiConsentCallout';
import { useAiStatus } from './useAiStatus';

const ICONS = { 'do-first': ListStart, move: CalendarClock, 'hand-over': ArrowRightLeft };

/**
 * "Plan my week": a few concrete changes for the next seven days. The decision engine keeps the numbers;
 * every move or handover shown here already passed its what-if check, and applying one goes through the
 * same what-if "apply" as the planner, so the activity log and notifications follow as usual.
 */
export default function PlanPage() {
  useDocumentTitle('Plan my week');
  const { firstNameOf } = useFamily();
  const { mode, status, refresh } = useAiStatus();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'applied' | 'dismissed'>>({});
  const [applying, setApplying] = useState<string | null>(null);

  const suggest = async () => {
    setState('loading');
    setError(null);
    try {
      setPlan(await aiService.plan(mode));
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

      <div className="mb-6 space-y-4">
        <AiConsentCallout />
        {mode === 'ai' && status && (
          <p className="text-sm text-ink-muted">
            AI requests today: {status.usedToday} of {status.dailyLimit}.
          </p>
        )}
      </div>

      {state === 'error' ? (
        <ErrorState message={error ?? undefined} onRetry={() => void suggest()} />
      ) : state === 'loading' ? (
        <ListSkeleton rows={3} />
      ) : !plan ? (
        <EmptyState
          icon={<Sparkles aria-hidden="true" />}
          title="Ready when you are"
          description="Hearth looks at your next seven days and the family’s clashes, then suggests a few changes. Nothing changes until you press Apply."
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
                          <p className="mt-1 text-sm text-ink-muted">{s.reason}</p>
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
    </>
  );
}
