import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, ClipboardList, Plus, Send, ShoppingBasket, Trash2, Wallet } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { nutritionService } from '@/services/care/nutritionService';
import { decisionService } from '@/services/decision/decisionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, toDateInputValue } from '@/lib/dates';
import { currency } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  FormError,
  IconButton,
  Input,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  QuantityStepper,
  RadioCards,
  SegmentedControl,
  useToast,
} from '@/components/ui';
import { ScorePill } from '@/components/domain/Scores';
import type { GroceryItem } from '@/types/domain';

export default function GroceryPlanPage() {
  useDocumentTitle('Grocery planning');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { family, members } = useFamily();
  const data = useAsync(() => Promise.all([nutritionService.listGroceries(), nutritionService.getPlan()]), []);
  const [filter, setFilter] = useState<'all' | 'needed' | 'in-pantry'>('all');
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unit: '' });
  const [itemError, setItemError] = useState<string>();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const [when, setWhen] = useState({ date: toDateInputValue(tomorrow), time: '16:00' });
  const [runner, setRunner] = useState<string>('');
  const update = useMutation(nutritionService.updateGroceryItem);
  const remove = useMutation(nutritionService.removeGroceryItem);
  const addCustom = useMutation(nutritionService.addCustomItem);
  const createTask = useMutation(nutritionService.createGroceryTask);

  const start = when.date && when.time ? combineDateTime(when.date, when.time) : '';
  const scores = useAsync(() => (start ? decisionService.previewCandidates({ category: 'errands', start, durationMin: 60 }) : Promise.resolve([])), [start]);
  const ranked = useMemo(() => (scores.data ?? []).filter((s) => members.some((m) => m.id === s.memberId)), [scores.data, members]);
  const selectedRunner = runner || ranked[0]?.memberId || '';

  const [items = [], plan] = data.data ?? [];
  const needed = items.filter((i) => i.status === 'needed');
  const total = needed.reduce((s, g) => s + g.estimatedPrice * g.quantity, 0);
  const shown = items.filter((i) => filter === 'all' || i.status === filter);
  const budgetMax = plan?.weeklyBudget.max ?? 0;

  const patch = async (item: GroceryItem, change: Partial<Pick<GroceryItem, 'quantity' | 'status'>>) => {
    data.setData((prev) => [prev![0].map((g) => (g.id === item.id ? { ...g, ...change } : g)), prev![1]]);
    const r = await update.run(item.id, change);
    if (!r) data.reload();
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) {
      setItemError('Enter an item name.');
      return;
    }
    setItemError(undefined);
    const r = await addCustom.run(newItem.name, newItem.quantity, newItem.unit);
    if (r) {
      setNewItem({ name: '', quantity: 1, unit: '' });
      data.reload();
    }
  };

  const onCreateTask = async () => {
    const task = await createTask.run(selectedRunner || null, start);
    if (task) {
      toast({ title: 'Grocery task created', description: task.title });
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Nutrition & groceries', to: '/nutrition' }, { label: 'Grocery planning' }]}
        title="Weekly grocery planning"
        description="Review the list, adjust quantities, and turn it into a household errand."
        actions={
          <ButtonLink to="/nutrition/recommendations" variant="secondary" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
            Add from food options
          </ButtonLink>
        }
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <div className="flex items-center justify-between">
                <p className="eyebrow">Estimated cost</p>
                {budgetMax > 0 && (
                  <Badge tone={total <= budgetMax ? 'mint' : 'amber'} dot>
                    {total <= budgetMax ? 'Within budget' : 'Over budget'}
                  </Badge>
                )}
              </div>
              <p className="mt-2 font-display text-3xl">~{currency(total)}</p>
              {budgetMax > 0 && <ProgressBar value={total} max={budgetMax} tone={total <= budgetMax ? 'mint' : 'amber'} label="Spending against weekly budget" className="mt-3" />}
              <p className="mt-2 text-xs text-ink-subtle">{budgetMax > 0 ? `Weekly budget up to ${currency(budgetMax)}` : 'Custom items have no price estimate.'}</p>
            </Card>
            <Card>
              <p className="eyebrow">To buy</p>
              <p className="mt-2 font-display text-3xl">
                {needed.length} <span className="font-sans text-base text-ink-muted">item{needed.length === 1 ? '' : 's'}</span>
              </p>
              <p className="mt-2 text-sm text-ink-muted">{items.length - needed.length} already in the pantry</p>
            </Card>
            <Card>
              <p className="eyebrow">For</p>
              <p className="mt-2 font-semibold text-ink">{family?.recipient.name}</p>
              <p className="text-sm text-ink-muted">{plan ? `${plan.goals.map((g) => g.title).join(' · ')}` : 'No nutrition goals set'}</p>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardHeader
                title="Shopping checklist"
                icon={<ClipboardList aria-hidden="true" className="h-5 w-5" />}
                action={
                  <SegmentedControl
                    label="Show"
                    size="sm"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: 'all', label: `All (${items.length})` },
                      { value: 'needed', label: `To buy (${needed.length})` },
                      { value: 'in-pantry', label: `In pantry (${items.length - needed.length})` },
                    ]}
                  />
                }
              />
              {shown.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ShoppingBasket aria-hidden="true" />}
                  title={items.length ? 'Nothing in this view' : 'Your list is empty'}
                  description="Add items from food options, or type your own below."
                />
              ) : (
                <ul className="space-y-2">
                  {shown.map((item) => (
                    <li key={item.id} className={cn('flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center', item.status === 'in-pantry' ? 'bg-mint-50/70' : 'bg-surface-muted')}>
                      <div className="min-w-0 flex-1">
                        <Checkbox
                          checked={item.status === 'in-pantry'}
                          onChange={(e) => patch(item, { status: e.target.checked ? 'in-pantry' : 'needed' })}
                          label={<span className={item.status === 'in-pantry' ? 'text-ink-subtle line-through' : ''}>{item.name}</span>}
                          description={`${item.group} · ${item.unit}${item.estimatedPrice ? ` · ~${currency(item.estimatedPrice)} each` : ''}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <QuantityStepper label={`quantity of ${item.name}`} value={item.quantity} onChange={(q) => patch(item, { quantity: q })} />
                        <IconButton
                          label={`Remove ${item.name}`}
                          size="sm"
                          onClick={async () => {
                            await remove.run(item.id);
                            data.reload();
                          }}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={onAdd} noValidate className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto]">
                <div>
                  <label htmlFor="grocery-name" className="sr-only">
                    Item name
                  </label>
                  <Input
                    id="grocery-name"
                    placeholder="Add your own item"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    aria-invalid={itemError ? true : undefined}
                  />
                </div>
                <div>
                  <label htmlFor="grocery-qty" className="sr-only">
                    Quantity
                  </label>
                  <Input id="grocery-qty" type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <div>
                  <label htmlFor="grocery-unit" className="sr-only">
                    Unit
                  </label>
                  <Input id="grocery-unit" placeholder="Unit" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
                </div>
                <Button type="submit" variant="soft" loading={addCustom.pending} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
                  Add
                </Button>
                {itemError && <p className="text-[13px] font-medium text-red-600 sm:col-span-4">{itemError}</p>}
              </form>
            </Card>

            <Card as="aside">
              <p className="eyebrow mb-1 flex items-center gap-1.5 text-primary-700">
                <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" /> Household coordination
              </p>
              <h2 className="font-display text-xl">Turn into a family task</h2>
              <p className="mt-1 text-sm text-ink-muted">Bundle the items to buy into one errand for someone who is free.</p>
              <FormError message={createTask.error} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <label className="text-[13px] font-semibold text-ink">
                  Day
                  <Input className="mt-1" type="date" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} />
                </label>
                <label className="text-[13px] font-semibold text-ink">
                  Time
                  <Input className="mt-1" type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} />
                </label>
              </div>
              <div className="mt-4">
                {ranked.length ? (
                  <RadioCards
                    name="runner"
                    legend="Errand runner"
                    value={selectedRunner}
                    onChange={setRunner}
                    options={ranked.map((c, i) => {
                      const m = members.find((x) => x.id === c.memberId)!;
                      return {
                        value: c.memberId,
                        label: m.name,
                        description: c.cautions[0] ?? c.reasons[0],
                        aside: i === 0 ? <Badge tone="mint">Recommended</Badge> : <ScorePill score={c.score} label="Suitability" />,
                      };
                    })}
                  />
                ) : (
                  <p className="text-sm text-ink-subtle">Invite people to your circle to share errands.</p>
                )}
              </div>
              <Button block className="mt-5" loading={createTask.pending} disabled={!needed.length || !start} onClick={onCreateTask} leftIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
                Create grocery task ({needed.length} item{needed.length === 1 ? '' : 's'})
              </Button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-subtle">
                <Wallet aria-hidden="true" className="h-3.5 w-3.5" /> The runner is notified in Hearth.
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
