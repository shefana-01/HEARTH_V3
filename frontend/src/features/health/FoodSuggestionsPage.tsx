import { useState } from 'react';
import { Info, Salad, ShoppingBasket } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { healthService } from '@/services/care/healthService';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { plural } from '@/lib/format';
import { Button, ButtonLink, Callout, EmptyState, ErrorState, FormField, ListSkeleton, PageHeader, Select, ToggleChip } from '@/components/ui';
import { FoodSuggestionCard } from './FoodSuggestionCard';
import { ADVICE_LINE, NUTRITION_TAGS, matchedTags, reasonPeople } from './healthText';
import { useAddToList } from './useAddToList';
import type { FoodSuggestion, NutritionTag } from '@/types/domain';

const EVERYONE = 'all';

/** Keep only the reasons that are about one person, so each card reads as "for them". */
function forPerson(foods: FoodSuggestion[], personId: string): FoodSuggestion[] {
  if (personId === EVERYONE) return foods;
  return foods.flatMap((food) => {
    const reasons = food.reasons.filter((r) => r.personId === personId);
    return reasons.length ? [{ ...food, reasons }] : [];
  });
}

export default function FoodSuggestionsPage() {
  useDocumentTitle('Food suggestions');
  const { me, personName } = useFamily();
  const data = useAsync(() => healthService.getSuggestions(), []);
  const list = useAddToList();
  const [personId, setPersonId] = useState(EVERYONE);
  const [tags, setTags] = useState<NutritionTag[]>([]);

  const all = data.data ?? [];
  const peopleInResults = Array.from(new Set(all.flatMap((f) => reasonPeople(f.reasons))));
  const byPerson = forPerson(all, personId);
  const availableTags = NUTRITION_TAGS.filter((tag) => byPerson.some((f) => matchedTags(f.reasons).includes(tag)));
  const activeTags = tags.filter((tag) => availableTags.includes(tag));
  const shown = activeTags.length ? byPerson.filter((f) => matchedTags(f.reasons).some((tag) => activeTags.includes(tag))) : byPerson;

  const clearFilters = () => {
    setPersonId(EVERYONE);
    setTags([]);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Health & food', to: '/health' }, { label: 'Food suggestions' }]}
        title="Food suggestions"
        description="Everyday foods that match the health notes you can see."
        actions={
          <ButtonLink to="/groceries" variant="secondary" leftIcon={<ShoppingBasket aria-hidden="true" className="h-4 w-4" />}>
            Shopping list
          </ButtonLink>
        }
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={3} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={<Salad aria-hidden="true" />}
          tone="mint"
          title="No suggestions yet"
          description="Suggestions appear once a health note is added."
          action={
            <>
              {me && <ButtonLink to={`/health/${me.id}`}>Add a health note</ButtonLink>}
              <ButtonLink to="/health" variant="secondary">
                Back to Health & food
              </ButtonLink>
            </>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <FormField label="Show suggestions for" className="lg:w-72">
              {(p) => (
                <Select {...p} value={personId} onChange={(e) => setPersonId(e.target.value)}>
                  <option value={EVERYONE}>Everyone I can see</option>
                  {peopleInResults.map((id) => (
                    <option key={id} value={id}>
                      {id === me?.id ? 'Me' : personName(id)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-sm font-semibold text-ink">Food focus</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by food focus">
                {availableTags.map((tag) => (
                  <ToggleChip key={tag} pressed={activeTags.includes(tag)} onClick={() => setTags(activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag])}>
                    {NUTRITION_TAG_LABELS[tag]}
                  </ToggleChip>
                ))}
              </div>
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={<Info aria-hidden="true" />}
              title="Nothing matches these filters"
              description="Try another person or food focus."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <p className="text-sm text-ink-muted" aria-live="polite">
                Showing {plural(shown.length, 'food')}
              </p>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((food) => (
                  <li key={food.id}>
                    <FoodSuggestionCard food={food} list={list} headingLevel="h2" detailed />
                  </li>
                ))}
              </ul>
            </>
          )}

          <Callout tone="neutral" icon={<Info aria-hidden="true" />}>
            {ADVICE_LINE} Foods come from a general reference list and leave out anything a person has said to avoid.
          </Callout>
        </div>
      )}
    </>
  );
}
