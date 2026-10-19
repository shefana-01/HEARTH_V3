/**
 * Health notes a person can add to their profile, and the kinds of food each
 * one points to.
 *
 * This is a fixed, reviewed list — Hearth does not read reports or guess
 * conditions. A person (or the family, for a dependant) ticks what a doctor
 * has told them, and Hearth uses the tags to suggest everyday foods for the
 * shopping list. It is general food guidance, not diagnosis or treatment.
 *
 * The backend keeps the same list (`care-service/.../conditions.json`); the
 * ids and tags must match. `tools/verify/catalogue-parity.mjs` checks that.
 */
import type { HealthCondition } from '@/types/domain';

export const HEALTH_CONDITIONS: HealthCondition[] = [
  { id: 'low-iron', label: 'Low iron or anaemia', summary: 'Iron-rich foods help, and vitamin C helps the body take the iron in.', tags: ['iron', 'vitamin-c'] },
  {
    id: 'period-pain',
    label: 'Period pain (dysmenorrhea)',
    summary: 'Iron replaces what is lost; magnesium, omega-3 and plenty of fluids may ease cramps.',
    tags: ['iron', 'magnesium', 'omega-3', 'hydration'],
  },
  { id: 'high-blood-pressure', label: 'High blood pressure', summary: 'Less salt and more heart-friendly foods.', tags: ['low-sodium', 'heart'] },
  { id: 'high-blood-sugar', label: 'High blood sugar or diabetes', summary: 'Slow-release, high-fibre foods keep energy steady.', tags: ['low-glycemic', 'high-fibre'] },
  { id: 'high-cholesterol', label: 'High cholesterol', summary: 'Fibre and omega-3 fats support a healthy heart.', tags: ['heart', 'high-fibre', 'omega-3'] },
  { id: 'weak-bones', label: 'Weak bones or low calcium', summary: 'Calcium-rich foods for bones and teeth.', tags: ['calcium'] },
  { id: 'constipation', label: 'Constipation', summary: 'More fibre and more fluids.', tags: ['high-fibre', 'hydration'] },
  { id: 'low-energy', label: 'Often tired or low on energy', summary: 'Iron, protein and slow-release foods help energy last.', tags: ['iron', 'high-protein', 'low-glycemic'] },
  { id: 'recovering', label: 'Recovering from illness or surgery', summary: 'Protein to rebuild, fluids, and food that is easy to eat.', tags: ['high-protein', 'hydration', 'soft-texture'] },
  { id: 'frequent-colds', label: 'Frequent colds', summary: 'Vitamin C and plenty of fluids.', tags: ['vitamin-c', 'hydration'] },
  { id: 'chewing-difficulty', label: 'Trouble chewing or swallowing', summary: 'Soft foods that are still nourishing.', tags: ['soft-texture', 'high-protein'] },
  { id: 'dehydration', label: 'Not drinking enough', summary: 'Watery foods and drinks through the day.', tags: ['hydration'] },
  { id: 'muscle-cramps', label: 'Muscle cramps', summary: 'Magnesium and fluids.', tags: ['magnesium', 'hydration'] },
  { id: 'growing-child', label: 'Growing child or teenager', summary: 'Calcium, protein and iron for growth.', tags: ['calcium', 'high-protein', 'iron'] },
];

const BY_ID = new Map(HEALTH_CONDITIONS.map((c) => [c.id, c]));

export const conditionById = (id: string) => BY_ID.get(id);
