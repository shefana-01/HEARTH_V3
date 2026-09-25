import { conditionById } from '@/constants/conditions';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import type { HealthProfile, NutritionTag, SuggestionReason } from '@/types/domain';

/** Shown next to every food suggestion. */
export const ADVICE_LINE = 'General food guidance, not medical advice.';

export const NUTRITION_TAGS = Object.keys(NUTRITION_TAG_LABELS) as NutritionTag[];

const unique = <T>(list: T[]) => Array.from(new Set(list));

/** "Iron, Vitamin C" */
const tagList = (tags: NutritionTag[]) => tags.map((t) => NUTRITION_TAG_LABELS[t]).join(', ');

/** Every tag a food was matched on, across all the people it suits. */
export const matchedTags = (reasons: SuggestionReason[]) => unique(reasons.flatMap((r) => r.tags));

/** Everyone a food was suggested for. */
export const reasonPeople = (reasons: SuggestionReason[]) => unique(reasons.map((r) => r.personId));

export interface PersonReason {
  personId: string;
  tags: NutritionTag[];
  /** Condition labels and goal titles, ready for a sentence. */
  because: string[];
}

/** One entry per person: what the food gives them and which of their notes it matches. */
export function reasonsByPerson(reasons: SuggestionReason[]): PersonReason[] {
  return reasonPeople(reasons).map((personId) => {
    const own = reasons.filter((r) => r.personId === personId);
    return { personId, tags: matchedTags(own), because: unique(own.map((r) => r.because)) };
  });
}

/** "Iron — for you (Low iron or anaemia)" */
export const reasonLine = (reason: PersonReason, who: string) => `${tagList(reason.tags)} — for ${who} (${reason.because.join(', ')})`;

/** "Rice, lentil soup , " → ["Rice", "lentil soup"] */
export const splitList = (text: string) =>
  unique(
    text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );

export const isEmptyProfile = (p: HealthProfile) => !p.conditions.length && !p.goals.length && !p.avoid.length && !p.preferences.length && !p.notes.trim();

/** Labels of the ticked health notes, skipping ids the list no longer has. */
export const conditionLabels = (ids: string[]) => ids.flatMap((id) => conditionById(id)?.label ?? []);

/** The HTTP-style status a service error carries, if any. */
export const errorStatus = (error: unknown) => (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : undefined);
