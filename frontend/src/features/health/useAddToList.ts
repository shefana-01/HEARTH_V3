import { useState } from 'react';
import { groceryService } from '@/services/care/groceryService';
import { useToast } from '@/components/ui';
import { matchedTags, reasonPeople } from './healthText';
import type { FoodSuggestion } from '@/types/domain';

export interface AddToList {
  add: (food: FoodSuggestion) => Promise<void>;
  /** The food being added right now, if any. */
  busyId: string | null;
  isOnList: (food: FoodSuggestion) => boolean;
}

/** Put a suggested food on the family shopping list and remember that it is there. */
export function useAddToList(): AddToList {
  const { toast } = useToast();
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async (food: FoodSuggestion) => {
    setBusyId(food.id);
    try {
      await groceryService.addFood({ foodId: food.id, forIds: reasonPeople(food.reasons), tags: matchedTags(food.reasons) });
      setAdded((prev) => new Set(prev).add(food.id));
      toast({ title: 'Added to the shopping list', description: food.name });
    } catch (error) {
      toast({ tone: 'error', title: 'Couldn’t add it to the list', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  return { add, busyId, isOnList: (food) => food.onList || added.has(food.id) };
}
