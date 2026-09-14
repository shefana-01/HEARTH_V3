import { useState, type FormEvent } from 'react';
import { ArrowRight, Ban, CookingPot, Info, Plus, Salad, SlidersHorizontal, Target, Trash2, Utensils, Wallet } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { nutritionService } from '@/services/care/nutritionService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { timeAgo } from '@/lib/dates';
import { currency } from '@/lib/format';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { Badge, Button, ButtonLink, Callout, Card, CardHeader, Dialog, EmptyState, ErrorState, FormError, FormField, Input, PageHeader, PageSkeleton, Textarea, ToggleChip, useToast } from '@/components/ui';
import type { NutritionPlan, NutritionTag } from '@/types/domain';

type Draft = Omit<NutritionPlan, 'updatedAt'>;

const TAGS = Object.keys(NUTRITION_TAG_LABELS) as NutritionTag[];
const EMPTY: Draft = { goals: [{ id: 'g1', title: '', target: '', tags: [] }], preferences: [], avoid: [], preparationNote: '', weeklyBudget: { min: 0, max: 0 }, reviewedBy: '' };

function PlanEditor({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: Draft; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [prefs, setPrefs] = useState(initial.preferences.join(', '));
  const [avoid, setAvoid] = useState(initial.avoid.join(', '));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useMutation(nutritionService.savePlan);
  const { toast } = useToast();

  const setGoal = (i: number, patch: Partial<Draft['goals'][number]>) => setDraft((d) => ({ ...d, goals: d.goals.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string | undefined> = {};
    draft.goals.forEach((g, i) => {
      if (!g.title.trim()) e2[`title-${i}`] = 'Name this goal.';
      if (!g.tags.length) e2[`tags-${i}`] = 'Choose at least one food focus.';
    });
    if (!draft.goals.length) e2.goals = 'Add at least one goal.';
    if (draft.weeklyBudget.max && draft.weeklyBudget.max < draft.weeklyBudget.min) e2.budget = 'The maximum must be at least the minimum.';
    setErrors(e2);
    if (Object.values(e2).some(Boolean)) return;
    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const saved = await save.run({ ...draft, goals: draft.goals.map((g) => ({ ...g, title: g.title.trim(), target: g.target.trim() })), preferences: split(prefs), avoid: split(avoid) });
    if (saved) {
      toast({ title: 'Nutrition plan saved' });
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Nutrition goals & preferences"
      description="Use goals your family agreed on, ideally with a doctor or dietitian."
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="nutrition-form" loading={save.pending}>
            Save plan
          </Button>
        </>
      }
    >
      <form id="nutrition-form" onSubmit={onSubmit} noValidate className="space-y-6">
        <FormError message={save.error} />
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-ink">Goals</legend>
          {draft.goals.map((g, i) => (
            <div key={g.id} className="rounded-2xl border border-line p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Goal" required error={errors[`title-${i}`]}>
                  {(p) => <Input {...p} value={g.title} onChange={(e) => setGoal(i, { title: e.target.value })} placeholder="e.g. Heart health" />}
                </FormField>
                <FormField label="Target" aside="Optional">
                  {(p) => <Input {...p} value={g.target} onChange={(e) => setGoal(i, { target: e.target.value })} placeholder="e.g. Less than 1,500 mg salt a day" />}
                </FormField>
              </div>
              <p className="mb-2 mt-4 text-[13px] font-semibold text-ink">Food focus</p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <ToggleChip key={t} pressed={g.tags.includes(t)} onClick={() => setGoal(i, { tags: g.tags.includes(t) ? g.tags.filter((x) => x !== t) : [...g.tags, t] })}>
                    {NUTRITION_TAG_LABELS[t]}
                  </ToggleChip>
                ))}
              </div>
              {errors[`tags-${i}`] && <p className="mt-2 text-[13px] font-medium text-red-600">{errors[`tags-${i}`]}</p>}
              {draft.goals.length > 1 && (
                <Button variant="danger-ghost" size="sm" className="mt-3" leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setDraft((d) => ({ ...d, goals: d.goals.filter((_, j) => j !== i) }))}>
                  Remove goal
                </Button>
              )}
            </div>
          ))}
          <Button variant="soft" size="sm" leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={() => setDraft((d) => ({ ...d, goals: [...d.goals, { id: crypto.randomUUID(), title: '', target: '', tags: [] }] }))}>
            Add a goal
          </Button>
        </fieldset>
        <FormField label="Favourite foods" hint="Separate with commas.">
          {(p) => <Input {...p} value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="Lentil soup, rice, berries" />}
        </FormField>
        <FormField label="Foods to avoid" hint="Hearth will leave these out of food options. Separate with commas.">
          {(p) => <Input {...p} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Grapefruit, stock cubes" />}
        </FormField>
        <FormField label="Preparation notes" aside="Optional">
          {(p) => <Textarea {...p} value={draft.preparationNote} onChange={(e) => setDraft({ ...draft, preparationNote: e.target.value })} placeholder="e.g. Soft textures, mild spices" />}
        </FormField>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Weekly budget from ($)">
            {(p) => <Input {...p} type="number" min={0} inputMode="decimal" value={draft.weeklyBudget.min || ''} onChange={(e) => setDraft({ ...draft, weeklyBudget: { ...draft.weeklyBudget, min: Number(e.target.value) } })} />}
          </FormField>
          <FormField label="to ($)" error={errors.budget}>
            {(p) => <Input {...p} type="number" min={0} inputMode="decimal" value={draft.weeklyBudget.max || ''} onChange={(e) => setDraft({ ...draft, weeklyBudget: { ...draft.weeklyBudget, max: Number(e.target.value) } })} />}
          </FormField>
          <FormField label="Reviewed by" aside="Optional">
            {(p) => <Input {...p} value={draft.reviewedBy} onChange={(e) => setDraft({ ...draft, reviewedBy: e.target.value })} placeholder="e.g. Family doctor" />}
          </FormField>
        </div>
      </form>
    </Dialog>
  );
}

export default function NutritionGoalsPage() {
  useDocumentTitle('Nutrition goals');
  const { family } = useFamily();
  const plan = useAsync(() => nutritionService.getPlan(), []);
  const [editing, setEditing] = useState(false);

  if (plan.status === 'loading' && plan.data === undefined) return <PageSkeleton />;
  if (plan.status === 'error') return <ErrorState headingLevel="h1" message={plan.error?.message} onRetry={plan.reload} />;
  const p = plan.data;
  const name = family?.recipient.name ?? 'your loved one';

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Nutrition & groceries' }, { label: name }]}
        title="Nutrition & wellness goals"
        description={`An everyday food plan for ${name}, shaped by the goals your family sets.`}
        actions={
          p && (
            <>
              <Button variant="secondary" leftIcon={<SlidersHorizontal aria-hidden="true" className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit preferences
              </Button>
              <ButtonLink to="/nutrition/recommendations" rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                Explore food options
              </ButtonLink>
            </>
          )
        }
      />

      {!p ? (
        <EmptyState
          icon={<Salad aria-hidden="true" />}
          tone="mint"
          title="No nutrition goals yet"
          description="Add the goals your family (or a professional) agreed on. Hearth will match everyday foods to them and help plan the shopping."
          action={<Button onClick={() => setEditing(true)}>Set up nutrition goals</Button>}
        />
      ) : (
        <div className="space-y-6">
          <Card tone="muted" padding="sm" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-ink-muted">
              {p.reviewedBy ? (
                <>
                  Reviewed by <span className="font-semibold text-ink">{p.reviewedBy}</span>
                </>
              ) : (
                'Not reviewed by a professional yet'
              )}
            </p>
            <Badge tone="mint" dot>
              Updated {timeAgo(p.updatedAt)}
            </Badge>
          </Card>

          <section aria-labelledby="goals-heading">
            <h2 id="goals-heading" className="mb-3 font-display text-xl">
              Active goals <Badge className="ml-1 align-middle">{p.goals.length}</Badge>
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {p.goals.map((g, i) => (
                <li key={g.id}>
                  <Card className="h-full">
                    <Badge tone={i === 0 ? 'mint' : 'primary'} dot className="mb-3">
                      {i === 0 ? 'Primary goal' : 'Supporting goal'}
                    </Badge>
                    <h3 className="font-display text-xl">{g.title}</h3>
                    {g.target && (
                      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-mint-50 px-3 py-1 text-sm font-semibold text-mint-800">
                        <Target aria-hidden="true" className="h-4 w-4" /> {g.target}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {g.tags.map((t) => (
                        <Badge key={t} tone="primary">
                          {NUTRITION_TAG_LABELS[t]}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Food preferences" description="Familiar staples & comfort tastes" icon={<Utensils aria-hidden="true" className="h-5 w-5" />} />
              {p.preferences.length ? (
                <ul className="flex flex-wrap gap-2">
                  {p.preferences.map((f) => (
                    <li key={f} className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-ink">
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">No favourites added.</p>
              )}
              {p.preparationNote && (
                <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-ink-muted">
                  <CookingPot aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {p.preparationNote}
                </p>
              )}
            </Card>
            <Card>
              <CardHeader title="Foods to avoid" description="Left out of every food option" icon={<Ban aria-hidden="true" className="h-5 w-5" />} />
              {p.avoid.length ? (
                <ul className="space-y-2">
                  {p.avoid.map((a) => (
                    <li key={a} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
                      <Ban aria-hidden="true" className="h-4 w-4" /> {a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">Nothing listed.</p>
              )}
            </Card>
          </div>

          {p.weeklyBudget.max > 0 && (
            <Card className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wallet aria-hidden="true" className="h-5 w-5 text-primary-600" />
                <div>
                  <p className="eyebrow">Weekly food budget</p>
                  <p className="font-semibold text-ink">Shared by the family</p>
                </div>
              </div>
              <p className="font-display text-2xl text-primary-700">
                {currency(p.weeklyBudget.min)} ΓÇô {currency(p.weeklyBudget.max)}
              </p>
            </Card>
          )}

          <Callout tone="neutral" icon={<Info aria-hidden="true" />}>
            Based on the goals configured here or provided by a professional, Hearth presents matching food options. It doesnΓÇÖt diagnose conditions or replace medical or dietary advice.
          </Callout>
        </div>
      )}

      {editing && <PlanEditor open={editing} onClose={() => setEditing(false)} initial={p ? { ...p } : EMPTY} onSaved={plan.reload} />}
    </>
  );
}
