/**
 * MOCK DATA — optional sample family for demos ("Explore with sample data").
 *
 * This is ordinary data in the same generic shape a real family creates
 * through onboarding. No page or component depends on these names.
 * All times are generated relative to "now" so the sample always looks current.
 */
import type { FamilyMember, Skill, TimeWindow } from '@/types/domain';
import { at } from '@/lib/dates';
import type { Workspace } from '@/services/mockStore';

const ALL_DAYS = [true, true, true, true, true, true, true];

const win = (id: string, label: string, start: string, end: string): TimeWindow => ({ id, label, start, end });

function member(
  id: string,
  name: string,
  relation: string,
  role: FamilyMember['role'],
  focus: string,
  skills: Skill[],
  windows: TimeWindow[],
  access: Partial<FamilyMember['access']> = {},
): FamilyMember {
  return {
    id,
    name,
    relation,
    role,
    focus,
    email: `${name.split(' ')[0].toLowerCase()}@example.com`,
    status: 'active',
    skills,
    availability: { days: ALL_DAYS, windows },
    access: { schedule: true, medical: false, documents: false, ...access },
    joinedAt: at(-200, '10:00'),
  };
}

export function buildSampleWorkspace(): Workspace {
  const lead = 'm-afsara';
  return {
    version: 2,
    isSample: true,
    sampleSeededOn: new Date().toDateString(),
    account: { id: 'acc-sample', memberId: lead, name: 'Afsara Mannan', email: 'afsara@example.com', about: 'Usually free for afternoon check-ins and medication reminders.' },
    family: {
      id: 'fam-sample',
      name: 'The Mannan Family',
      location: 'Dhaka, Bangladesh',
      careFocus: 'Elderly parent care',
      createdAt: at(-200, '10:00'),
      inviteCode: 'HEARTH-892',
      recipient: {
        id: 'rec-sample',
        name: 'Nazmun Nahar',
        relation: 'Mother',
        birthYear: new Date().getFullYear() - 74,
        careNotes: 'Gentle daily routine, soft indoor stretches and an afternoon tea. Needs an arm to lean on for stairs.',
      },
    },
    members: [
      member(lead, 'Afsara Mannan', 'Daughter', 'lead', 'Daily vitals & clinic visits', ['clinical', 'medication', 'driving', 'meals'], [win('w1', 'Morning', '07:00', '11:00'), win('w2', 'Afternoon & evening', '14:00', '21:00')], { medical: true, documents: true }),
      member('m-nusrat', 'Nusrat Mannan', 'Daughter', 'contributor', 'Medication & protocol reviews', ['clinical', 'medication'], [win('w1', 'Midday calls', '10:00', '13:00')], { medical: true, documents: true }),
      member('m-kanitah', 'Kanitah Mannan', 'Daughter', 'contributor', 'Grocery runs & weekend drives', ['errands', 'driving', 'companionship'], [win('w1', 'Evening', '18:30', '21:00')]),
      member('m-rafid', 'Rafid Mannan', 'Son', 'contributor', 'Evening walks & transport backup', ['driving', 'mobility', 'errands'], [win('w1', 'After work', '17:30', '21:00')]),
      member('m-tariq', 'Tariq Mannan', 'Son', 'contributor', 'Clinic transport', ['driving', 'medication'], [win('w1', 'Afternoon', '12:30', '16:00')]),
      member('m-amina', 'Amina Tariq', 'Daughter-in-law', 'contributor', 'Meals & fresh groceries', ['meals', 'errands', 'driving'], [win('w1', 'Late afternoon', '16:30', '19:00')]),
    ],
    unavailability: [
      { id: 'u1', memberId: 'm-tariq', start: at(0, '13:00'), end: at(0, '18:30'), reason: 'Work shift extended', note: 'Called in for an urgent hospital shift.', createdAt: at(0, '13:15') },
    ],
    tasks: [
      { id: 't1', title: 'Morning blood pressure & vitals', notes: 'Seated reading after 3 quiet minutes, cuff at heart level.', category: 'vitals', priority: 'important', status: 'completed', start: at(0, '08:00'), durationMin: 15, assigneeId: lead, createdById: lead, createdAt: at(-7, '09:00'), completedAt: at(0, '08:20'), completedById: lead, reminder: true },
      { id: 't2', title: 'Low-sodium lunch & water jug', notes: 'Use the low-sodium broth; refill the water jug by the chair.', category: 'meals', priority: 'routine', status: 'scheduled', start: at(0, '12:30'), durationMin: 30, assigneeId: 'm-amina', createdById: lead, createdAt: at(-3, '09:00'), reminder: false },
      { id: 't3', title: 'Drive to cardiology follow-up', notes: 'Pick up at home, help on the lobby stairs, check in at the desk.', category: 'transport', priority: 'urgent', status: 'scheduled', start: at(0, '15:00'), durationMin: 105, assigneeId: 'm-tariq', createdById: lead, createdAt: at(-5, '09:00'), appointmentId: 'a1', reminder: true },
      { id: 't4', title: 'Afternoon garden walk', notes: 'Twenty minutes, then a seated BP reading.', category: 'mobility', priority: 'routine', status: 'scheduled', start: at(0, '16:00'), durationMin: 30, assigneeId: 'm-rafid', createdById: lead, createdAt: at(-5, '09:00'), reminder: false },
      { id: 't5', title: 'Pharmacy pickup & fresh groceries', notes: 'Collect the prescription refill, then spinach, bananas and broth.', category: 'errands', priority: 'important', status: 'scheduled', start: at(0, '17:00'), durationMin: 45, assigneeId: 'm-tariq', createdById: lead, createdAt: at(-2, '09:00'), reminder: true },
      { id: 't6', title: 'Evening medication & wind-down', notes: 'Evening tablets with warm milk.', category: 'medication', priority: 'important', status: 'scheduled', start: at(0, '20:30'), durationMin: 30, assigneeId: lead, createdById: lead, createdAt: at(-7, '09:00'), reminder: true },
      { id: 't7', title: 'Morning vitals & glucose log', notes: 'Fasting reading before breakfast. Retake on the other arm if systolic is above 135.', category: 'vitals', priority: 'important', status: 'scheduled', start: at(1, '08:30'), durationMin: 15, assigneeId: lead, createdById: lead, createdAt: at(-7, '09:00'), reminder: true },
      { id: 't8', title: 'Physiotherapy session', notes: 'Bring the resistance band and water.', category: 'mobility', priority: 'routine', status: 'scheduled', start: at(1, '10:00'), durationMin: 60, assigneeId: 'm-rafid', createdById: lead, createdAt: at(-4, '09:00'), reminder: false },
      { id: 't9', title: 'Evening companionship visit', notes: 'Tea and a board game.', category: 'companionship', priority: 'routine', status: 'scheduled', start: at(1, '18:30'), durationMin: 60, assigneeId: null, createdById: lead, createdAt: at(-1, '09:00'), reminder: false },
      { id: 't10', title: 'Weekly grocery run', notes: 'See the grocery plan.', category: 'errands', priority: 'routine', status: 'scheduled', start: at(2, '14:00'), durationMin: 60, assigneeId: 'm-kanitah', createdById: lead, createdAt: at(-1, '09:00'), reminder: false },
      { id: 't11', title: 'Refill the weekly pill organiser', notes: 'Check remaining stock and note anything running low.', category: 'medication', priority: 'routine', status: 'scheduled', start: at(3, '10:00'), durationMin: 30, assigneeId: lead, createdById: lead, createdAt: at(-7, '09:00'), reminder: true },
      { id: 't12', title: 'Evening walk', notes: '', category: 'mobility', priority: 'routine', status: 'completed', start: at(-1, '18:30'), durationMin: 30, assigneeId: 'm-rafid', createdById: lead, createdAt: at(-4, '09:00'), completedAt: at(-1, '19:05'), completedById: 'm-rafid', reminder: false },
    ],
    appointments: [
      { id: 'a1', title: 'Cardiology follow-up', specialty: 'Cardiology', start: at(0, '15:30'), durationMin: 60, provider: 'Dr. Aris Thorne', location: 'St. Jude Medical Plaza, Suite 408', escortId: 'm-tariq', prep: [{ id: 'p1', label: 'Bring the 7-day blood pressure notebook', done: true, doneById: lead }, { id: 'p2', label: 'Bring the paper glucose log', done: false }], note: 'The doctor will review whether the blood pressure dose needs adjusting.', createdAt: at(-10, '09:00') },
      { id: 'a2', title: 'Routine cardiology review', specialty: 'Cardiology', start: at(27, '10:30'), durationMin: 60, provider: 'Dr. Aris Thorne', location: 'St. Jude Medical Plaza, Suite 410', escortId: lead, prep: [{ id: 'p1', label: 'Print the weekly blood pressure log', done: true, doneById: lead }, { id: 'p2', label: 'Pack the medication pouches', done: true, doneById: 'm-kanitah' }], note: '', createdAt: at(-2, '09:00') },
      { id: 'a3', title: 'Eye pressure check', specialty: 'Ophthalmology', start: at(38, '15:00'), durationMin: 45, provider: 'Westside Vision Clinic', location: 'Westside Vision Clinic, Clinic 2', escortId: 'm-kanitah', prep: [{ id: 'p1', label: 'Pause the morning eye drops 24 hours before (as instructed by the clinic)', done: false }, { id: 'p2', label: 'Pack her current reading glasses', done: false }], note: '', createdAt: at(-2, '09:00') },
    ],
    reassignments: [],
    notifications: [
      { id: 'n1', type: 'availability', message: 'Tariq Mannan reported being unavailable today from 1:00 PM to 6:30 PM.', createdAt: at(0, '13:15'), read: false, href: '/priority' },
      { id: 'n2', type: 'nutrition', message: 'Nusrat Mannan updated the nutrition plan: sodium under 1,500 mg a day.', createdAt: at(-1, '10:45'), read: false, href: '/nutrition' },
      { id: 'n3', type: 'task', message: 'Rafid Mannan completed “Evening walk”.', createdAt: at(-1, '19:05'), read: true, href: '/tasks' },
    ],
    audit: [
      { id: 'e1', actorId: 'm-tariq', category: 'schedule', action: 'Reported unavailability', subject: 'Today, 1:00 PM – 6:30 PM', at: at(0, '13:15'), after: 'Work shift extended' },
      { id: 'e2', actorId: lead, category: 'tasks', action: 'Completed a task', subject: 'Morning blood pressure & vitals', at: at(0, '08:20') },
      { id: 'e3', actorId: 'm-nusrat', category: 'care', action: 'Updated the nutrition plan', subject: 'Heart & blood pressure goal', at: at(-1, '10:45'), before: 'Sodium under 2,000 mg a day', after: 'Sodium under 1,500 mg a day' },
      { id: 'e4', actorId: 'm-rafid', category: 'tasks', action: 'Completed a task', subject: 'Evening walk', at: at(-1, '19:05') },
    ],
    documents: [
      { id: 'd1', title: 'Cardiology care summary', category: 'Clinical summary', fileName: 'cardiology-summary.pdf', sizeKB: 1400, uploadedAt: at(-5, '09:00'), uploadedById: lead, access: 'circle', allowedIds: [], appointmentId: 'a2' },
      { id: 'd2', title: 'Eye drop prescription', category: 'Prescription', fileName: 'eye-drop-rx.pdf', sizeKB: 340, uploadedAt: at(-11, '11:20'), uploadedById: 'm-nusrat', access: 'restricted', allowedIds: [lead, 'm-nusrat'], appointmentId: 'a3' },
      { id: 'd3', title: 'Low-sodium meal guide', category: 'Care guideline', fileName: 'meal-guide.pdf', sizeKB: 512, uploadedAt: at(-17, '16:05'), uploadedById: 'm-nusrat', access: 'circle', allowedIds: [] },
      { id: 'd4', title: 'Healthcare proxy', category: 'Legal', fileName: 'healthcare-proxy.pdf', sizeKB: 3800, uploadedAt: at(-54, '10:00'), uploadedById: lead, access: 'restricted', allowedIds: [lead, 'm-nusrat'] },
    ],
    nutrition: {
      goals: [
        { id: 'g1', title: 'Heart & blood pressure', target: 'Sodium under 1,500 mg a day', tags: ['low-sodium', 'heart'] },
        { id: 'g2', title: 'Steady energy', target: 'Low-glycemic whole foods', tags: ['low-glycemic', 'high-fibre'] },
      ],
      preferences: ['Mild curries', 'Basmati rice', 'Lentil daal', 'Fresh berries'],
      avoid: ['Grapefruit', 'Stock cubes'],
      preparationNote: 'Soft textures, gently simmered broths and warm vegetable stews.',
      weeklyBudget: { min: 140, max: 160 },
      reviewedBy: 'Nusrat Mannan',
      updatedAt: at(-1, '10:45'),
    },
    groceries: [
      { id: 'gr1', name: 'Salmon fillet', group: 'Fish & seafood', quantity: 1, unit: '2 fillets', estimatedPrice: 14.5, status: 'in-pantry', foodId: 'salmon' },
      { id: 'gr2', name: 'Baby spinach', group: 'Vegetables', quantity: 1, unit: 'tub', estimatedPrice: 4.8, status: 'needed', foodId: 'spinach' },
      { id: 'gr3', name: 'Steel-cut oats', group: 'Grains', quantity: 1, unit: 'canister', estimatedPrice: 6.2, status: 'needed', foodId: 'oats' },
      { id: 'gr4', name: 'Blueberries', group: 'Fruit', quantity: 2, unit: 'pints', estimatedPrice: 7.5, status: 'needed', foodId: 'berries' },
    ],
  };
}
