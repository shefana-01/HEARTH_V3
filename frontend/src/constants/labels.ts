import {
  Activity,
  Bell,
  Car,
  CalendarClock,
  CalendarX2,
  ArrowRightLeft,
  Coffee,
  Footprints,
  HeartHandshake,
  Pill,
  Salad,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AuditCategory, DocumentCategory, MemberRole, NotificationType, NutritionTag, Skill, TaskCategory, TaskPriority, Tone } from '@/types/domain';

export const TASK_CATEGORIES: Record<TaskCategory, { label: string; icon: LucideIcon; tone: Tone }> = {
  medication: { label: 'Medication', icon: Pill, tone: 'rose' },
  vitals: { label: 'Vitals & checks', icon: Activity, tone: 'rose' },
  meals: { label: 'Meals & nutrition', icon: Salad, tone: 'mint' },
  errands: { label: 'Errands & groceries', icon: ShoppingBasket, tone: 'amber' },
  mobility: { label: 'Mobility & exercise', icon: Footprints, tone: 'mint' },
  transport: { label: 'Transport & escort', icon: Car, tone: 'primary' },
  companionship: { label: 'Companionship', icon: Coffee, tone: 'primary' },
  other: { label: 'Other', icon: HeartHandshake, tone: 'neutral' },
};

export const PRIORITIES: Record<TaskPriority, { label: string; tone: Tone }> = {
  routine: { label: 'Routine', tone: 'neutral' },
  important: { label: 'Important', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'red' },
};

export const SKILLS: Record<Skill, string> = {
  driving: 'Driving',
  medication: 'Medication',
  errands: 'Errands',
  meals: 'Meals',
  mobility: 'Mobility help',
  companionship: 'Companionship',
  clinical: 'Clinical checks',
};

export const ROLES: Record<MemberRole, { label: string; description: string }> = {
  lead: { label: 'Lead caregiver', description: 'Coordinates the circle and approves changes.' },
  contributor: { label: 'Contributor', description: 'Takes on tasks and shares updates.' },
  observer: { label: 'Observer', description: 'Receives updates only.' },
};

export const CARE_FOCUS_OPTIONS = ['Elderly parent care', 'Recovery after surgery or illness', 'Long-term condition support', 'Disability support', 'Child or teen care', 'General family wellbeing'];

export const RELATION_SUGGESTIONS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Daughter', 'Son', 'Sister', 'Brother', 'Spouse', 'Partner', 'Aunt', 'Uncle', 'Friend', 'Neighbour', 'Carer'];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['Clinical summary', 'Prescription', 'Care guideline', 'Lab result', 'Legal', 'Other'];

export const UNAVAILABILITY_REASONS = ['Work', 'Travel', 'Feeling unwell', 'Family commitment', 'Other'];

export const NOTIFICATION_TYPES: Record<NotificationType, { label: string; icon: LucideIcon; tone: Tone }> = {
  task: { label: 'Task', icon: HeartHandshake, tone: 'primary' },
  reassignment: { label: 'Reassignment', icon: ArrowRightLeft, tone: 'mint' },
  conflict: { label: 'Conflict', icon: TriangleAlert, tone: 'red' },
  availability: { label: 'Availability', icon: CalendarX2, tone: 'amber' },
  appointment: { label: 'Appointment', icon: CalendarClock, tone: 'primary' },
  nutrition: { label: 'Nutrition', icon: Salad, tone: 'mint' },
  circle: { label: 'Circle', icon: Users, tone: 'rose' },
};

export const AUDIT_CATEGORIES: Record<AuditCategory, { label: string; tone: Tone; icon: LucideIcon }> = {
  tasks: { label: 'Tasks', tone: 'primary', icon: HeartHandshake },
  schedule: { label: 'Schedule', tone: 'amber', icon: CalendarClock },
  care: { label: 'Care records', tone: 'mint', icon: Sparkles },
  circle: { label: 'Circle', tone: 'rose', icon: Bell },
};

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const NUTRITION_TAG_LABELS: Record<NutritionTag, string> = {
  'low-sodium': 'Low sodium',
  heart: 'Heart health',
  'low-glycemic': 'Steady energy',
  'high-fibre': 'High fibre',
  'high-protein': 'High protein',
  'soft-texture': 'Soft texture',
  iron: 'Iron',
  hydration: 'Hydration',
};
