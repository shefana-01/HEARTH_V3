/**
 * Health notes and food suggestions — care-service.
 *
 * Each person keeps a short health profile: things a doctor has told them
 * (picked from a fixed list), their own goals, and foods to avoid. Hearth
 * matches everyday foods to those notes so they can go on the shopping list.
 *
 * It does not read documents, diagnose, or recommend treatment. A member's
 * profile is theirs: the family only sees it if they choose to share it.
 */
import { apiRequest, query } from '../api/client';
import { config } from '../config';
import { actorId, audit, canSeeHealth, db, fail, isDependant, isLead, me, nowIso, persist, personName, respond } from '../mockStore';
import { conditionById } from '@/constants/conditions';
import { foodOptions } from '@/mocks/foods';
import type { FoodOption, FoodSuggestion, HealthProfile, HealthProfileInput, NutritionTag, SuggestionReason } from '@/types/domain';

const blank = (personId: string): HealthProfile => ({ personId, conditions: [], goals: [], avoid: [], preferences: [], notes: '', shared: isDependant(personId), updatedAt: nowIso() });

/** Own profile always; a dependant's with "medical" access (the organiser always has it). */
function canEdit(personId: string): boolean {
  if (personId === actorId()) return true;
  return isDependant(personId) && (isLead() || Boolean(me()?.access.medical));
}

const isAvoided = (food: FoodOption, avoid: string[]) => {
  const text = `${food.name} ${food.localName ?? ''}`.toLowerCase();
  return avoid.some((a) => a.trim() && text.includes(a.trim().toLowerCase()));
};

/** Pure: what each profile needs, matched against the food list. Most widely useful first, then cheapest. */
export function suggestFoods(profiles: HealthProfile[], foods: FoodOption[], onList: (foodId: string) => boolean): FoodSuggestion[] {
  const needs = profiles.flatMap((p) => [
    ...p.conditions.flatMap((id) => {
      const c = conditionById(id);
      return c ? [{ profile: p, because: c.label, tags: c.tags }] : [];
    }),
    ...p.goals.map((g) => ({ profile: p, because: g.title, tags: g.tags })),
  ]);

  return foods
    .map((food) => {
      const reasons: SuggestionReason[] = needs
        .filter((n) => !isAvoided(food, n.profile.avoid))
        .map((n) => ({ personId: n.profile.personId, because: n.because, tags: n.tags.filter((t: NutritionTag) => food.tags.includes(t)) }))
        .filter((r) => r.tags.length > 0);
      return { ...food, reasons, onList: onList(food.id) };
    })
    .filter((f) => f.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.estimatedPrice - b.estimatedPrice || a.name.localeCompare(b.name));
}

export const healthService = {
  /** Profiles the signed-in person may see that have something in them, plus their own. */
  async listProfiles(): Promise<HealthProfile[]> {
    if (!config.useMocks) return apiRequest<HealthProfile[]>('/health/profiles');
    const mine = db.health.find((h) => h.personId === actorId()) ?? blank(actorId());
    return respond([mine, ...db.health.filter((h) => h.personId !== actorId() && canSeeHealth(h.personId))]);
  },

  /** One person's profile; an empty one if nothing was saved yet. */
  async getProfile(personId: string): Promise<HealthProfile> {
    if (!config.useMocks) return apiRequest<HealthProfile>(`/health/profiles/${personId}`);
    if (!canSeeHealth(personId) && !canEdit(personId)) return fail('This person keeps their health notes private.', 403);
    return respond(db.health.find((h) => h.personId === personId) ?? blank(personId));
  },

  async saveProfile(personId: string, input: HealthProfileInput): Promise<HealthProfile> {
    if (!config.useMocks) return apiRequest<HealthProfile>(`/health/profiles/${personId}`, { method: 'PUT', body: input });
    if (!canEdit(personId)) return fail('You can only change your own health notes, or those of someone the family looks after.', 403);
    const profile: HealthProfile = {
      personId,
      conditions: input.conditions.filter((id) => conditionById(id)),
      goals: input.goals.filter((g) => g.title.trim() && g.tags.length).map((g) => ({ ...g, title: g.title.trim(), target: g.target.trim() })),
      avoid: input.avoid.map((a) => a.trim()).filter(Boolean),
      preferences: input.preferences.map((a) => a.trim()).filter(Boolean),
      notes: input.notes.trim(),
      shared: isDependant(personId) ? true : input.shared,
      updatedAt: nowIso(),
    };
    db.health = [...db.health.filter((h) => h.personId !== personId), profile];
    // Only what the family is allowed to know goes in the shared activity log.
    if (profile.shared) audit({ category: 'care', action: 'Updated health notes', subject: personName(personId) });
    persist();
    return respond(profile);
  },

  /**
   * Foods that match the health notes of the people the signed-in person can
   * see (or of one of them), each with the reason it is suggested.
   */
  async getSuggestions(personId?: string): Promise<FoodSuggestion[]> {
    if (!config.useMocks) return apiRequest<FoodSuggestion[]>(`/health/suggestions${query({ personId })}`);
    const profiles = db.health.filter((h) => (personId ? h.personId === personId : true) && canSeeHealth(h.personId));
    return respond(suggestFoods(profiles, foodOptions, (id) => db.groceries.some((g) => g.foodId === id)));
  },
};
