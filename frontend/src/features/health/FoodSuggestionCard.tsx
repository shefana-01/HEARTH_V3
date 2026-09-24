import { Check, ShoppingCart } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { currency } from '@/lib/format';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { matchedTags, reasonLine, reasonsByPerson } from './healthText';
import { useWho } from './useWho';
import type { AddToList } from './useAddToList';
import type { FoodSuggestion } from '@/types/domain';

/** One suggested food: what it is good for, who it is for, and a way to put it on the shopping list. */
export function FoodSuggestionCard({ food, list, headingLevel: Heading, detailed = false }: { food: FoodSuggestion; list: AddToList; headingLevel: 'h2' | 'h3'; detailed?: boolean }) {
  const who = useWho();
  const onList = list.isOnList(food);

  return (
    <Card as="article" className="flex h-full flex-col">
      {detailed && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge>{food.group}</Badge>
          <span className="text-sm font-semibold text-ink-muted">About {currency(food.estimatedPrice)}</span>
        </div>
      )}
      <Heading className="font-display text-xl">
        {food.name}
        {food.localName && <span className="ml-2 font-sans text-sm font-normal text-ink-muted">{food.localName}</span>}
      </Heading>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {matchedTags(food.reasons).map((tag) => (
          <Badge key={tag} tone="mint">
            {NUTRITION_TAG_LABELS[tag]}
          </Badge>
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm text-ink-muted">
        {reasonsByPerson(food.reasons).map((reason) => (
          <li key={reason.personId}>{reasonLine(reason, who(reason.personId))}</li>
        ))}
      </ul>
      {detailed && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-ink-muted">{food.description}</p>
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-[0.8125rem] text-ink">
            <span className="eyebrow mr-2">Portion</span>
            {food.portion}
          </p>
          {food.alternatives.length > 0 && <p className="text-[0.8125rem] text-ink-muted">Or try: {food.alternatives.join(', ')}</p>}
        </div>
      )}
      <div className="mt-4 flex flex-1 items-end">
        {onList ? (
          <p className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-mint-700">
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} /> On the list
          </p>
        ) : (
          <Button
            variant="soft"
            block
            className="min-h-11"
            loading={list.busyId === food.id}
            disabled={list.busyId !== null && list.busyId !== food.id}
            onClick={() => list.add(food)}
            leftIcon={<ShoppingCart aria-hidden="true" className="h-4 w-4" />}
          >
            Add to shopping list
          </Button>
        )}
      </div>
    </Card>
  );
}
