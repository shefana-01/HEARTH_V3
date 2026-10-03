import {
  Activity,
  AlarmClock,
  Baby,
  Bell,
  BookOpen,
  Briefcase,
  Car,
  CalendarClock,
  CalendarX2,
  ArrowRightLeft,
  Dumbbell,
  GraduationCap,
  HeartHandshake,
  Home,
  Pill,
  Plane,
  Salad,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AuditCategory, DocumentCategory, EventKind, MemberRole, NotificationType, NutritionTag, Skill, TaskCategory, TaskPriority, Tone } from '@/types/domain';

export const TASK_CATEGORIES: Record<TaskCategory, { label: string; icon: LucideIcon; tone: Tone }> = {
  medication: { label: 'Medication', icon: Pill, tone: 'rose' },
  health: { label: 'Health & check-ups', icon: Activity, tone: 'rose' },
  meals: { label: 'Meals & cooking', icon: Salad, tone: 'mint' },
  errands: { label: 'Errands & shopping', icon: ShoppingBasket, tone: 'amber' },
  household: { label: 'Household', icon: Home, tone: 'amber' },
  childcare: { label: 'Childcare', icon: Baby, tone: 'rose' },
  transport: { label: 'Pick-up & drop-off', icon: Car, tone: 'primary' },
  study: { label: 'Study', icon: BookOpen, tone: 'primary' },
  work: { label: 'Work', icon: Briefcase, tone: 'primary' },
  exercise: { label: 'Exercise & wellbeing', icon: Dumbbell, tone: 'mint' },
  family: { label: 'Family time', icon: HeartHandshake, tone: 'mint' },
  other: { label: 'Other', icon: Sparkles, tone: 'neutral' },
};

/** Categories that are usually a person's own business, so new tasks in them start as private. */
export const PERSONAL_CATEGORIES: TaskCategory[] = ['study', 'work', 'exercise'];

export const PRIORITIES: Record<TaskPriority, { label: string; tone: Tone }> = {
  routine: { label: 'Routine', tone: 'neutral' },
  important: { label: 'Important', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'red' },
};

export const SKILLS: Record<Skill, string> = {
  driving: 'Driving',
  medication: 'Medication',
  errands: 'Errands & shopping',
  meals: 'Cooking',
  household: 'Housework',
  childcare: 'Looking after children',
  mobility: 'Physical help',
  companionship: 'Keeping company',
  clinical: 'Health checks',
};

export const ROLES: Record<MemberRole, { label: string; description: string }> = {
  lead: { label: 'Organiser', description: 'Set up the family space. Can invite people and change who sees what.' },
  contributor: { label: 'Member', description: 'Takes on tasks, shares their schedule and joins the family chat.' },
  observer: { label: 'Follower', description: 'Sees updates but is not given tasks.' },
};

export const EVENT_KINDS: Record<EventKind, { label: string; icon: LucideIcon }> = {
  class: { label: 'Class', icon: GraduationCap },
  work: { label: 'Work', icon: Briefcase },
  personal: { label: 'Personal', icon: UserRound },
  travel: { label: 'Travel', icon: Plane },
  other: { label: 'Other', icon: CalendarClock },
};

export const RELATION_SUGGESTIONS = [
  'Mother',
  'Father',
  'Grandmother',
  'Grandfather',
  'Daughter',
  'Son',
  'Sister',
  'Brother',
  'Spouse',
  'Partner',
  'Aunt',
  'Uncle',
  'Cousin',
  'Friend',
  'Neighbour',
  'Carer',
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['Medical report', 'Prescription', 'Lab result', 'Insurance', 'ID & legal', 'School & work', 'Bills & receipts', 'Other'];

export const UNAVAILABILITY_REASONS = ['Class', 'Work', 'Travel', 'Feeling unwell', 'Family commitment', 'Other'];

/** Quick picks for the status line. */
export const STATUS_SUGGESTIONS = ['In class', 'At work', 'On my way home', 'Free to help', 'Resting', 'Out shopping'];

export const NOTIFICATION_TYPES: Record<NotificationType, { label: string; icon: LucideIcon; tone: Tone }> = {
  task: { label: 'Task', icon: HeartHandshake, tone: 'primary' },
  reassignment: { label: 'Handover', icon: ArrowRightLeft, tone: 'mint' },
  conflict: { label: 'Clash', icon: TriangleAlert, tone: 'red' },
  availability: { label: 'Availability', icon: CalendarX2, tone: 'amber' },
  appointment: { label: 'Appointment', icon: CalendarClock, tone: 'primary' },
  nutrition: { label: 'Health & food', icon: Salad, tone: 'mint' },
  circle: { label: 'Family', icon: Users, tone: 'rose' },
  reminder: { label: 'Reminder', icon: AlarmClock, tone: 'amber' },
};

export const AUDIT_CATEGORIES: Record<AuditCategory, { label: string; tone: Tone; icon: LucideIcon }> = {
  tasks: { label: 'Tasks', tone: 'primary', icon: HeartHandshake },
  schedule: { label: 'Schedule', tone: 'amber', icon: CalendarClock },
  care: { label: 'Health & records', tone: 'mint', icon: Sparkles },
  circle: { label: 'Family', tone: 'rose', icon: Bell },
};

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const NUTRITION_TAG_LABELS: Record<NutritionTag, string> = {
  iron: 'Iron',
  'vitamin-c': 'Vitamin C',
  calcium: 'Calcium',
  magnesium: 'Magnesium',
  'omega-3': 'Omega-3',
  'low-sodium': 'Low salt',
  heart: 'Heart-friendly',
  'low-glycemic': 'Steady energy',
  'high-fibre': 'High fibre',
  'high-protein': 'High protein',
  'soft-texture': 'Soft & gentle',
  hydration: 'Hydration',
};
