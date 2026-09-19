import { useState } from 'react';
import { ArrowRight, Check, Info, ShoppingBag, ShoppingCart, Target } from 'lucide-react';
import { nutritionService, type FoodMatch } from '@/services/care/nutritionService';
import { useFamily } from '@/app/FamilyProvider';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { currency } from '@/lib/format';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { Badge, Button, ButtonLink, Callout, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, ToggleChip, useToast } from '@/components/ui';

export default function FoodRecommendationsPage() {
  useDocumentTitle('Food options');
  const { family } = useFamily();
  const { toast } = useToast();
  const data = useAsync(() => Promise.all([nutritionService.getPlan(), nutritionService.getFoodMatches(), nutritionService.listGroceries()]), []);
  const [goal, setGoal] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const add = useMutation(nutritionService.addFoodToList);
  const remove = useMutation(nutritionService.removeGroceryItem);

  const [plan, foods = [], groceries = []] = data.data ?? [];
  const shown = foods.filter((f) => goal === 'all' || f.matchedGoals.includes(goal));
  const needed = groceries.filter((g) => g.status === 'needed');
  const total = needed.reduce((s, g) => s + g.estimatedPrice * g.quantity, 0);

  const toggle = async (f: FoodMatch) => {
    setBusyId(f.id);
    if (f.onList) {
      const item = groceries.find((g) => g.foodId === f.id);
      if (item) await remove.run(item.id);
    } else {
      const item = await add.run(f.id);
      if (item) toast({ title: 'Added to the grocery list', description: f.name });
      else toast({ tone: 'error', title: 'Couldn’t add it', description: 'Please try again.' });
    }
    await data.reload();
    setBusyId(null);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Nutrition & groceries', to: '/nutrition' }, { label: 'Food options' }]}
        eyebrow="Everyday nourishment"
        title="Food options"
        description={`Everyday foods that match the goals your family set for ${family?.recipient.name ?? 'your loved one'}.`}
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={3} />
      ) : !plan ? (
        <EmptyState
          icon={<Target aria-hidden="true" />}
          title="Set nutrition goals first"
          description="Food options are matched to the goals your family configures."
          action={<ButtonLink to="/nutrition">Set up goals</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by goal">
            <ToggleChip pressed={goal === 'all'} onClick={() => setGoal('all')}>
              All options ({foods.length})
            </ToggleChip>
            {plan.goals.map((g) => (
              <ToggleChip key={g.id} pressed={goal === g.title} onClick={() => setGoal(g.title)}>
                {g.title}
              </ToggleChip>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={<Info aria-hidden="true" />}
              title="No food options match this goal"
              description="Try adding more food focuses to the goal."
              action={<ButtonLink to="/nutrition">Edit goals</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((f) => (
                <li key={f.id}>
                  <Card className="flex h-full flex-col">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge>{f.group}</Badge>
                      <span className="text-sm font-semibold text-ink-muted">~{currency(f.estimatedPrice)}</span>
                    </div>
                    <h2 className="font-display text-xl">{f.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.matchedGoals.map((m) => (
                        <Badge key={m} tone="mint">
                          {m}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 flex-1 text-sm text-ink-muted">{f.description}</p>
                    <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-[13px] text-ink">
                      <span className="eyebrow mr-2">Portion</span>
                      {f.portion}
                    </p>
                    <p className="mt-2 text-xs text-ink-subtle">Good for: {f.tags.map((t) => NUTRITION_TAG_LABELS[t]).join(', ')}</p>
                    {f.alternatives.length > 0 && (
                      <details className="mt-2 text-[13px] text-ink-muted">
                        <summary className="cursor-pointer font-semibold text-primary-700">Alternatives</summary>
                        <p className="mt-1">{f.alternatives.join(' · ')}</p>
                      </details>
                    )}
                    <Button
                      className="mt-4"
                      block
                      variant={f.onList ? 'soft' : 'primary'}
                      loading={busyId === f.id}
                      disabled={busyId !== null && busyId !== f.id}
                      onClick={() => toggle(f)}
                      aria-pressed={f.onList}
                      leftIcon={f.onList ? <Check aria-hidden="true" className="h-4 w-4" /> : <ShoppingCart aria-hidden="true" className="h-4 w-4" />}
                    >
                      {f.onList ? 'On the grocery list' : 'Add to grocery list'}
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <Callout tone="neutral" icon={<Info aria-hidden="true" />} className="mt-6">
            Options come from a general food reference and are matched to your configured goals{plan.avoid.length ? `, leaving out: ${plan.avoid.join(', ')}` : ''}. They are suggestions, not medical
            advice.
          </Callout>

          <Card className="sticky bottom-4 z-10 mt-6 flex flex-col gap-3 shadow-raised sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-3 text-sm">
              <ShoppingBag aria-hidden="true" className="h-5 w-5 text-mint-600" />
              <span>
                <span className="font-semibold text-ink">
                  {needed.length} item{needed.length === 1 ? '' : 's'} to buy
                </span>
                <span className="text-ink-muted"> · about {currency(total)}</span>
              </span>
            </p>
            <ButtonLink to="/nutrition/groceries" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
              Continue to grocery planning
            </ButtonLink>
          </Card>
        </>
      )}
    </>
  );
}
