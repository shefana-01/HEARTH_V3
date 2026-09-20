/**
 * The family shopping list — care-service.
 *
 * One list for the household. Items can come from a food suggestion (then
 * they carry a short reason such as "Iron") or be typed in by hand.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, fail, isDependant, memberName, newId, notFound, notify, nowIso, persist, requireFamily, respond } from '../mockStore';
import { NUTRITION_TAG_LABELS } from '@/constants/labels';
import { foodOptions } from '@/mocks/foods';
import type { GroceryItem, NutritionTag, Task } from '@/types/domain';

export interface AddFoodInput {
  foodId: string;
  /** Who it is for. People whose health notes are private are left off the shared list. */
  forIds: string[];
  /** What it is good for, shown on the list. */
  tags: NutritionTag[];
}

/** Naming someone on the shared list would reveal a private health note, so only keep people who share theirs. */
const shareable = (personId: string) => isDependant(personId) || Boolean(db.health.find((h) => h.personId === personId)?.shared);

export const groceryService = {
  async list(): Promise<GroceryItem[]> {
    if (!config.useMocks) return apiRequest<GroceryItem[]>('/groceries');
    return respond(db.groceries);
  },

  async addFood(input: AddFoodInput): Promise<GroceryItem> {
    if (!config.useMocks) return apiRequest<GroceryItem>('/groceries/from-food', { method: 'POST', body: input });
    requireFamily();
    const food = foodOptions.find((f) => f.id === input.foodId);
    if (!food) return notFound('That food');
    const forIds = input.forIds.filter(shareable);
    const existing = db.groceries.find((g) => g.foodId === input.foodId);
    if (existing) {
      existing.forIds = Array.from(new Set([...existing.forIds, ...forIds]));
      persist();
      return respond(existing);
    }
    const item: GroceryItem = {
      id: newId('gr'),
      name: food.localName ? `${food.name} (${food.localName})` : food.name,
      group: food.group,
      quantity: 1,
      unit: food.portion,
      estimatedPrice: food.estimatedPrice,
      status: 'needed',
      foodId: food.id,
      forIds,
      reason:
        input.tags
          .filter((t) => food.tags.includes(t))
          .map((t) => NUTRITION_TAG_LABELS[t])
          .join(', ') || undefined,
      addedById: actorId(),
    };
    db.groceries.push(item);
    persist();
    return respond(item);
  },

  async addCustomItem(name: string, quantity: number, unit: string): Promise<GroceryItem> {
    if (!config.useMocks) return apiRequest<GroceryItem>('/groceries', { method: 'POST', body: { name, quantity, unit } });
    requireFamily();
    if (!name.trim()) return fail('Enter an item name.', 422);
    const item: GroceryItem = {
      id: newId('gr'),
      name: name.trim(),
      group: 'Other',
      quantity: Math.max(1, quantity),
      unit: unit.trim() || 'item',
      estimatedPrice: 0,
      status: 'needed',
      forIds: [],
      addedById: actorId(),
    };
    db.groceries.push(item);
    persist();
    return respond(item);
  },

  async updateItem(id: string, patch: Partial<Pick<GroceryItem, 'quantity' | 'status'>>): Promise<GroceryItem> {
    if (!config.useMocks) return apiRequest<GroceryItem>(`/groceries/${id}`, { method: 'PATCH', body: patch });
    const item = db.groceries.find((g) => g.id === id);
    if (!item) return notFound('That item');
    Object.assign(item, patch);
    if (item.quantity < 1) item.quantity = 1;
    persist();
    return respond(item);
  },

  async removeItem(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/groceries/${id}`, { method: 'DELETE' });
    db.groceries = db.groceries.filter((g) => g.id !== id);
    persist();
    return respond(undefined);
  },

  /** Turn everything still to buy into one shopping task for someone. */
  async createShoppingTask(assigneeId: string | null, start: string): Promise<Task> {
    if (!config.useMocks) return apiRequest<Task>('/groceries/task', { method: 'POST', body: { assigneeId, start } });
    requireFamily();
    const needed = db.groceries.filter((g) => g.status === 'needed');
    if (!needed.length) return fail('There is nothing left to buy.', 422);
    const task: Task = {
      id: newId('t'),
      title: `Shopping (${needed.length} item${needed.length === 1 ? '' : 's'})`,
      notes: needed.map((g) => `• ${g.name} — ${g.quantity} × ${g.unit}`).join('\n'),
      category: 'errands',
      priority: 'routine',
      status: 'scheduled',
      start,
      durationMin: 60,
      assigneeId,
      visibility: 'family',
      createdById: actorId(),
      createdAt: nowIso(),
      reminder: true,
    };
    db.tasks.push(task);
    audit({ category: 'tasks', action: 'Created a shopping task', subject: task.title, after: memberName(assigneeId) });
    if (assigneeId && assigneeId !== actorId()) {
      notify({
        type: 'task',
        forId: assigneeId,
        message: `${memberName(actorId()).split(' ')[0]} asked you to do the shopping (${needed.length} item${needed.length === 1 ? '' : 's'}).`,
        href: `/tasks/${task.id}`,
      });
    }
    persist();
    return respond(task);
  },
};
