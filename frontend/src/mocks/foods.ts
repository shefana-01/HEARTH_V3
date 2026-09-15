/**
 * MOCK DATA — reference food dataset.
 *
 * Stand-in for the verified nutrition dataset the care-service will provide.
 * Hearth only matches foods to goals the family has configured; it never
 * diagnoses or prescribes.
 */
import type { FoodOption } from '@/types/domain';

export const foodOptions: FoodOption[] = [
  { id: 'salmon', name: 'Salmon fillet', group: 'Fish & seafood', tags: ['heart', 'high-protein', 'low-sodium'], description: 'Rich in omega-3s. Bakes tender with mild spices and a little olive oil.', portion: '2 fillets (~12 oz)', estimatedPrice: 14.5, alternatives: ['Trout', 'Cod'] },
  { id: 'spinach', name: 'Baby spinach', group: 'Vegetables', tags: ['iron', 'heart', 'low-sodium', 'high-fibre'], description: 'Wilts quickly into lentils, soups or broths. Gentle and easy to cook soft.', portion: '1 lb tub', estimatedPrice: 4.8, alternatives: ['Bok choy', 'Kale'] },
  { id: 'oats', name: 'Steel-cut oats', group: 'Grains', tags: ['low-glycemic', 'high-fibre', 'heart'], description: 'Slow-releasing energy. Cook soft with cinnamon or cardamom.', portion: '32 oz canister', estimatedPrice: 6.2, alternatives: ['Barley flakes', 'Quinoa'] },
  { id: 'lentils', name: 'Red lentils', group: 'Legumes', tags: ['high-fibre', 'high-protein', 'iron', 'low-glycemic', 'soft-texture'], description: 'Cooks down to a soft daal in 20 minutes. Filling and inexpensive.', portion: '2 lb bag', estimatedPrice: 3.9, alternatives: ['Yellow split peas', 'Chickpeas'] },
  { id: 'berries', name: 'Blueberries', group: 'Fruit', tags: ['heart', 'low-glycemic', 'soft-texture'], description: 'Soft, sweet and easy to add to oats or yoghurt.', portion: '2 pints', estimatedPrice: 7.5, alternatives: ['Strawberries', 'Raspberries'] },
  { id: 'banana', name: 'Bananas', group: 'Fruit', tags: ['heart', 'soft-texture', 'low-sodium'], description: 'Soft, potassium-rich and ready to eat.', portion: '1 bunch', estimatedPrice: 1.9, alternatives: ['Papaya', 'Pears'] },
  { id: 'yoghurt', name: 'Plain yoghurt', group: 'Dairy', tags: ['high-protein', 'soft-texture'], description: 'Cool and soothing. Choose unsweetened.', portion: '32 oz tub', estimatedPrice: 4.2, alternatives: ['Kefir', 'Soft tofu'] },
  { id: 'sweet-potato', name: 'Sweet potatoes', group: 'Vegetables', tags: ['high-fibre', 'heart', 'soft-texture', 'low-sodium'], description: 'Roast or mash for a soft, naturally sweet side.', portion: '3 lb bag', estimatedPrice: 3.6, alternatives: ['Pumpkin', 'Carrots'] },
  { id: 'eggs', name: 'Eggs', group: 'Protein', tags: ['high-protein', 'soft-texture', 'iron'], description: 'Scrambled or poached — quick, soft protein.', portion: '1 dozen', estimatedPrice: 3.8, alternatives: ['Tofu', 'Paneer'] },
  { id: 'brown-rice', name: 'Brown basmati rice', group: 'Grains', tags: ['low-glycemic', 'high-fibre'], description: 'A slower-releasing swap for white rice.', portion: '2 lb bag', estimatedPrice: 4.5, alternatives: ['Wild rice', 'Bulgur'] },
  { id: 'broth', name: 'Low-sodium vegetable broth', group: 'Pantry', tags: ['low-sodium', 'hydration', 'soft-texture'], description: 'A base for soups and soft stews. Check the label for sodium.', portion: '32 oz carton', estimatedPrice: 3.2, alternatives: ['Homemade broth'] },
  { id: 'cucumber', name: 'Cucumbers', group: 'Vegetables', tags: ['hydration', 'low-sodium'], description: 'Crisp and hydrating. Peel for a softer texture.', portion: '3 pieces', estimatedPrice: 2.4, alternatives: ['Watermelon', 'Celery'] },
  { id: 'chicken', name: 'Skinless chicken breast', group: 'Protein', tags: ['high-protein', 'low-sodium'], description: 'Lean protein; poach or slow-cook to keep it tender.', portion: '1.5 lb', estimatedPrice: 8.9, alternatives: ['Turkey', 'Fish'] },
  { id: 'walnuts', name: 'Unsalted walnuts', group: 'Nuts & seeds', tags: ['heart', 'low-glycemic'], description: 'A heart-friendly snack. Choose unsalted.', portion: '8 oz bag', estimatedPrice: 5.6, alternatives: ['Almonds', 'Pumpkin seeds'] },
];
