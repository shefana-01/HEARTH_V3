/**
 * Nutrition goals, food options and grocery planning — care-service.
 *
 *
 * Hearth only matches food options to the goals the family has configured
 * (or that a professional provided). It does not diagnose or prescribe.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, fail, memberName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import { foodOptions } from '@/mocks/foods';
import type { CareTask, FoodOption, GroceryItem, NutritionPlan, NutritionTag } from '@/types/domain';

export interface FoodMatch extends FoodOption {
  matchedGoals: string[];
  onList: boolean;
}

const mentionsAvoided = (food: FoodOption, avoid: string[]) => avoid.some((a) => a.trim() && `${food.name} ${food.alternatives.join(' ')}`.toLowerCase().includes(a.trim().toLowerCase()));

export const nutritionService = {
  async getPlan(): Promise<NutritionPlan | null> {
    if (!config.useMocks) return (await apiRequest<NutritionPlan | undefined>('/nutrition/plan')) ?? null;
    return respond(db.nutrition);
  },

  async savePlan(plan: Omit<NutritionPlan, 'updatedAt'>): Promise<NutritionPlan> {
    if (!config.useMocks) return apiRequest<NutritionPlan>('/nutrition/plan', { method: 'PUT', body: plan });
    requireFamily();
    const before = db.nutrition?.goals.map((g) => g.target).join('; ');
    db.nutrition = { ...plan, updatedAt: nowIso() };
    audit({ category: 'care', action: 'Updated the nutrition plan', subject: 'Goals & preferences', before, after: plan.goals.map((g) => g.target).join('; ') });
    notify({ type: 'nutrition', message: `${memberName(actorId())} updated the nutrition plan.`, href: '/nutrition' });
    persist();
    return respond(db.nutrition);
  },

  /** Food options whose tags match at least one configured goal, excluding "avoid" items. */
  async getFoodMatches(): Promise<FoodMatch[]> {
    if (!config.useMocks) return apiRequest<FoodMatch[]>('/nutrition/food-matches');
    const plan = db.nutrition;
    if (!plan) return respond([]);
    const matches = foodOptions
      .filter((f) => !mentionsAvoided(f, plan.avoid))
      .map((f) => ({
        ...f,
        matchedGoals: plan.goals.filter((g) => g.tags.some((t: NutritionTag) => f.tags.includes(t))).map((g) => g.title),
        onList: db.groceries.some((g) => g.foodId === f.id),
      }))
      .filter((f) => f.matchedGoals.length > 0)
      .sort((a, b) => b.matchedGoals.length - a.matchedGoals.length || a.estimatedPrice - b.estimatedPrice);
    return respond(matches);
  },

  async listGroceries(): Promise<GroceryItem[]> {
    if (!config.useMocks) return apiRequest<GroceryItem[]>('/groceries');
    return respond(db.groceries);
  },

  async addFoodToList(foodId: string): Promise<GroceryItem> {
    if (!config.useMocks) return apiRequest<GroceryItem>('/groceries/from-food', { method: 'POST', body: { foodId } });
    const food = foodOptions.find((f) => f.id === foodId);
    if (!food) return notFound('That food');
    const existing = db.groceries.find((g) => g.foodId === foodId);
    if (existing) return respond(existing);
    const item: GroceryItem = { id: newId('gr'), name: food.name, group: food.group, quantity: 1, unit: food.portion, estimatedPrice: food.estimatedPrice, status: 'needed', foodId };
    db.groceries.push(item);
    persist();
    return respond(item);
  },

  async addCustomItem(name: string, quantity: number, unit: string): Promise<GroceryItem> {
    if (!config.useMocks) return apiRequest<GroceryItem>('/groceries', { method: 'POST', body: { name, quantity, unit } });
    if (!name.trim()) return fail('Enter an item name.', 422);
    const item: GroceryItem = { id: newId('gr'), name: name.trim(), group: 'Other', quantity: Math.max(1, quantity), unit: unit.trim() || 'item', estimatedPrice: 0, status: 'needed' };
    db.groceries.push(item);
    persist();
    return respond(item);
  },

  async updateGroceryItem(id: string, patch: Partial<Pick<GroceryItem, 'quantity' | 'status'>>): Promise<GroceryItem> {
    if (!config.useMocks) return apiRequest<GroceryItem>(`/groceries/${id}`, { method: 'PATCH', body: patch });
    const item = db.groceries.find((g) => g.id === id);
    if (!item) return notFound('That item');
    Object.assign(item, patch);
    if (item.quantity < 1) item.quantity = 1;
    persist();
    return respond(item);
  },

  async removeGroceryItem(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/groceries/${id}`, { method: 'DELETE' });
    db.groceries = db.groceries.filter((g) => g.id !== id);
    persist();
    return respond(undefined);
  },

  /** Bundle the "needed" items into a household errand task. */
  async createGroceryTask(assigneeId: string | null, start: string): Promise<CareTask> {
    if (!config.useMocks) return apiRequest<CareTask>('/groceries/task', { method: 'POST', body: { assigneeId, start } });
    requireFamily();
    const needed = db.groceries.filter((g) => g.status === 'needed');
    if (!needed.length) return fail('There are no items left to buy.', 422);
    const task: CareTask = {
      id: newId('t'),
      title: `Grocery run (${needed.length} item${needed.length === 1 ? '' : 's'})`,
      notes: needed.map((g) => `• ${g.name} — ${g.quantity} × ${g.unit}`).join('\n'),
      category: 'errands',
      priority: 'routine',
      status: 'scheduled',
      start,
      durationMin: 60,
      assigneeId,
      createdById: actorId(),
      createdAt: nowIso(),
      reminder: true,
    };
    db.tasks.push(task);
    audit({ category: 'tasks', action: 'Created a grocery task', subject: task.title, after: memberName(assigneeId) });
    if (assigneeId && assigneeId !== actorId()) {
      notify({ type: 'task', message: `${memberName(assigneeId).split(' ')[0]} was asked to do the grocery run.`, href: `/tasks/${task.id}` });
    }
    persist();
    return respond(task);
  },
};
