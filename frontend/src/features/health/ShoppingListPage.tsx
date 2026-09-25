import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Send, ShoppingBasket, Trash2, TriangleAlert, Wallet } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { groceryService } from '@/services/care/groceryService';
import { familyService } from '@/services/family/familyService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { combineDateTime, toDateInputValue } from '@/lib/dates';
import { currency, listNames, plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  FormError,
  FormField,
  IconButton,
  Input,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  QuantityStepper,
  Select,
  useToast,
} from '@/components/ui';
import { useWho } from './useWho';
import type { GroceryItem } from '@/types/domain';

type Patch = Partial<Pick<GroceryItem, 'quantity' | 'status'>>;

const estimate = (items: GroceryItem[]) => items.reduce((sum, item) => sum + item.estimatedPrice * item.quantity, 0);

function groupByGroup(items: GroceryItem[]): [string, GroceryItem[]][] {
  const groups = new Map<string, GroceryItem[]>();
  items.forEach((item) => groups.set(item.group, [...(groups.get(item.group) ?? []), item]));
  return Array.from(groups).sort(([a], [b]) => a.localeCompare(b));
}

function ItemRow({ item, onPatch, onRemove }: { item: GroceryItem; onPatch: (patch: Patch) => void; onRemove: () => void }) {
  const who = useWho();
  const atHome = item.status === 'in-pantry';
  const forText = item.forIds.length ? `for ${listNames(item.forIds.map(who))}` : '';
  const note = item.reason ? [item.reason, forText].filter(Boolean).join(' · ') : forText.charAt(0).toUpperCase() + forText.slice(1);

  return (
    <li className={cn('flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center', atHome ? 'bg-mint-50/70' : 'bg-surface-muted')}>
      <div className="min-w-0 flex-1">
        <Checkbox
          checked={atHome}
          onChange={(e) => onPatch({ status: e.target.checked ? 'in-pantry' : 'needed' })}
          label={<span className={atHome ? 'text-ink-subtle line-through' : ''}>{item.name}</span>}
          description={
            <>
              <span className="block">
                {item.unit}
                {item.estimatedPrice > 0 && ` · about ${currency(item.estimatedPrice)} each`}
              </span>
              {note && <span className="block font-medium text-mint-800">{note}</span>}
            </>
          }
        />
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <QuantityStepper label={`quantity of ${item.name}`} value={item.quantity} onChange={(quantity) => onPatch({ quantity })} />
        <IconButton label={`Remove ${item.name}`} onClick={onRemove}>
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </li>
  );
}

function ListSection({
  id,
  title,
  hint,
  empty,
  items,
  onPatch,
  onRemove,
}: {
  id: string;
  title: string;
  hint: string;
  empty: string;
  items: GroceryItem[];
  onPatch: (item: GroceryItem, patch: Patch) => void;
  onRemove: (item: GroceryItem) => void;
}) {
  return (
    <section aria-labelledby={id} className="mt-6 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={id} className="font-display text-lg">
          {title} <Badge className="ml-1 align-middle">{items.length}</Badge>
        </h3>
        <p className="text-[0.8125rem] text-ink-subtle">{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className="space-y-4">
          {groupByGroup(items).map(([group, list]) => (
            <div key={group}>
              <p className="eyebrow mb-2">{group}</p>
              <ul className="space-y-2">
                {list.map((item) => (
                  <ItemRow key={item.id} item={item} onPatch={(patch) => onPatch(item, patch)} onRemove={() => onRemove(item)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AddItemForm({ onAdded }: { onAdded: (item: GroceryItem) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', quantity: 1, unit: '' });
  const [nameError, setNameError] = useState<string>();
  const add = useMutation(groceryService.addCustomItem);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Enter an item name.');
      return;
    }
    setNameError(undefined);
    const item = await add.run(form.name, form.quantity, form.unit);
    if (item) {
      setForm({ name: '', quantity: 1, unit: '' });
      onAdded(item);
      toast({ title: 'Added to the shopping list', description: item.name });
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 border-t border-line pt-5" aria-labelledby="add-item-heading">
      <h3 id="add-item-heading" className="mb-3 font-display text-lg">
        Add an item
      </h3>
      <FormError message={add.error} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto] sm:items-end">
        <FormField label="Name" error={nameError}>
          {(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="For example, rice" />}
        </FormField>
        <FormField label="Quantity">
          {(p) => <Input {...p} type="number" min={1} inputMode="numeric" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value) || 1) })} />}
        </FormField>
        <FormField label="Unit">{(p) => <Input {...p} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, packet" />}</FormField>
        <Button type="submit" variant="soft" className="min-h-11" loading={add.pending} leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          Add
        </Button>
      </div>
    </form>
  );
}

function BudgetDialog({ open, onClose, current }: { open: boolean; onClose: () => void; current?: number }) {
  const { toast } = useToast();
  const { refresh } = useFamily();
  const [value, setValue] = useState(current ? String(current) : '');
  const save = useMutation(familyService.updateFamily);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, Math.round(Number(value) || 0));
    const saved = await save.run({ weeklyGroceryBudget: amount || undefined });
    if (saved) {
      await refresh();
      toast({ title: amount ? 'Weekly budget saved' : 'Weekly budget removed' });
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={current ? 'Edit weekly budget' : 'Set a weekly budget'}
      description="The most the family wants to spend on shopping in a week."
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="budget-form" loading={save.pending}>
            Save
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={save.error} />
        <FormField label="Weekly budget" hint="Leave empty to remove the budget.">
          {(p) => <Input {...p} type="number" min={0} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />}
        </FormField>
      </form>
    </Dialog>
  );
}

function ShoppingTaskDialog({ open, onClose, count }: { open: boolean; onClose: () => void; count: number }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { members, me } = useFamily();
  const [assigneeId, setAssigneeId] = useState(me?.id ?? '');
  const [date, setDate] = useState(toDateInputValue(new Date(Date.now() + 86_400_000)));
  const [time, setTime] = useState('16:00');
  const [error, setError] = useState<string>();
  const create = useMutation(groceryService.createShoppingTask);
  const helpers = members.filter((m) => m.status === 'active' && m.role !== 'observer');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      setError('Choose a day and a time.');
      return;
    }
    setError(undefined);
    const task = await create.run(assigneeId || null, combineDateTime(date, time));
    if (task) {
      toast({ title: 'Shopping task created', description: task.title });
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Turn into a shopping task"
      description={`${plural(count, 'item')} still to buy will go into one task.`}
      dismissible={!create.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button type="submit" form="shopping-task-form" loading={create.pending} leftIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
            Create task
          </Button>
        </>
      }
    >
      <form id="shopping-task-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={create.error ?? error} />
        <FormField label="Who will do the shopping?">
          {(p) => (
            <Select {...p} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Decide later</option>
              {helpers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me?.id ? `${m.name} (me)` : m.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Day">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</FormField>
          <FormField label="Time">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</FormField>
        </div>
      </form>
    </Dialog>
  );
}

function BudgetCard({ total, budget, canEdit, onEdit }: { total: number; budget?: number; canEdit: boolean; onEdit: () => void }) {
  const over = budget ? total - budget : 0;
  return (
    <Card>
      <p className="eyebrow">Weekly budget</p>
      {budget ? (
        <>
          <p className="mt-2 font-display text-3xl">{currency(budget)}</p>
          <ProgressBar value={total} max={budget} tone={over > 0 ? 'amber' : 'mint'} label="Estimated total against the weekly budget" className="mt-3" />
          <p className={cn('mt-2 flex items-center gap-1.5 text-sm', over > 0 ? 'font-semibold text-amber-700' : 'text-ink-muted')}>
            {over > 0 && <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />}
            {over > 0 ? `Over by ${currency(over)}` : `${currency(budget - total)} left`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{canEdit ? 'No weekly budget yet. Set one to see how the list compares.' : 'The organiser can set a weekly budget.'}</p>
      )}
      {canEdit && (
        <Button
          variant="secondary"
          className="mt-4 min-h-11"
          leftIcon={budget ? <Pencil aria-hidden="true" className="h-4 w-4" /> : <Wallet aria-hidden="true" className="h-4 w-4" />}
          onClick={onEdit}
        >
          {budget ? 'Edit budget' : 'Set a weekly budget'}
        </Button>
      )}
    </Card>
  );
}

export default function ShoppingListPage() {
  useDocumentTitle('Shopping list');
  const { toast } = useToast();
  const { family, isLead } = useFamily();
  const data = useAsync(() => groceryService.list(), []);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const update = useMutation(groceryService.updateItem);
  const remove = useMutation(groceryService.removeItem);

  const items = data.data ?? [];
  const needed = items.filter((i) => i.status === 'needed');
  const atHome = items.filter((i) => i.status === 'in-pantry');
  const total = estimate(needed);
  const hasUnpriced = needed.some((i) => i.estimatedPrice === 0);

  const patch = async (item: GroceryItem, change: Patch) => {
    data.setData((prev) => (prev ?? []).map((g) => (g.id === item.id ? { ...g, ...change } : g)));
    if (!(await update.run(item.id, change))) {
      toast({ tone: 'error', title: 'Couldn’t update the list', description: 'Please try again.' });
      void data.reload();
    }
  };

  const removeItem = async (item: GroceryItem) => {
    if (await remove.attempt(item.id)) data.setData((prev) => (prev ?? []).filter((g) => g.id !== item.id));
    else toast({ tone: 'error', title: 'Couldn’t remove the item', description: 'Please try again.' });
  };

  return (
    <>
      <PageHeader
        title="Shopping list"
        description="One list for the whole family. Tick what you already have at home."
        actions={
          <>
            <ButtonLink to="/health/suggestions" variant="secondary">
              Food suggestions
            </ButtonLink>
            <Button leftIcon={<Send aria-hidden="true" className="h-4 w-4" />} disabled={needed.length === 0} onClick={() => setTaskOpen(true)}>
              Turn into a shopping task
            </Button>
          </>
        }
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <p className="eyebrow">Estimated total</p>
              <p className="mt-2 font-display text-3xl">{currency(total)}</p>
              <p className="mt-2 text-sm text-ink-muted">
                {plural(needed.length, 'item')} to buy{hasUnpriced && '. Items without a price are not counted.'}
              </p>
            </Card>
            <BudgetCard total={total} budget={family?.weeklyGroceryBudget} canEdit={isLead} onEdit={() => setBudgetOpen(true)} />
          </div>

          <Card>
            <CardHeader title="The list" icon={<ShoppingBasket aria-hidden="true" className="h-5 w-5" />} />
            {items.length === 0 ? (
              <EmptyState
                compact
                icon={<ShoppingBasket aria-hidden="true" />}
                title="Your shopping list is empty"
                description="Add foods from the suggestions, or type your own below."
                action={<ButtonLink to="/health/suggestions">See food suggestions</ButtonLink>}
              />
            ) : (
              <>
                <ListSection
                  id="to-buy-heading"
                  title="To buy"
                  hint="Tick an item when you have it at home."
                  empty="Everything is already at home."
                  items={needed}
                  onPatch={patch}
                  onRemove={removeItem}
                />
                <ListSection
                  id="at-home-heading"
                  title="Already at home"
                  hint="Untick an item to put it back on the list."
                  empty="Nothing ticked yet."
                  items={atHome}
                  onPatch={patch}
                  onRemove={removeItem}
                />
              </>
            )}
            <AddItemForm onAdded={(item) => data.setData((prev) => [...(prev ?? []), item])} />
          </Card>
        </div>
      )}

      {budgetOpen && <BudgetDialog open onClose={() => setBudgetOpen(false)} current={family?.weeklyGroceryBudget} />}
      {taskOpen && <ShoppingTaskDialog open onClose={() => setTaskOpen(false)} count={needed.length} />}
    </>
  );
}
