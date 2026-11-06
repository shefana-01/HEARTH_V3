import {
  Bell,
  CalendarDays,
  CircleCheckBig,
  FlaskConical,
  FolderLock,
  HeartPulse,
  History,
  ListOrdered,
  MessagesSquare,
  Network,
  Pill,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path (not on pages below it that have their own item). */
  end?: boolean;
}

export function getNavSections(t: TranslationKeys): { title: string; items: NavItem[] }[] {
  return [
    {
      title: t.nav.meSection,
      items: [
        { to: '/today', label: t.nav.today, icon: Sun },
        { to: '/assistant', label: t.nav.assistant, icon: Sparkles },
        { to: '/tasks', label: t.nav.tasks, icon: CircleCheckBig },
        { to: '/plan', label: t.nav.plan, icon: Sparkles },
        { to: '/schedule', label: t.nav.schedule, icon: CalendarDays },
        { to: '/health', label: t.nav.health, icon: HeartPulse, end: true },
        { to: '/health/medicines', label: t.nav.medicines, icon: Pill },
      ],
    },
    {
      title: t.nav.familySection,
      items: [
        { to: '/family', label: t.nav.family, icon: Users },
        { to: '/chat', label: t.nav.chat, icon: MessagesSquare },
        { to: '/priority', label: t.nav.priority, icon: ListOrdered },
        { to: '/groceries', label: t.nav.groceries, icon: ShoppingBasket },
        { to: '/appointments', label: t.nav.appointments, icon: Stethoscope },
        { to: '/documents', label: t.nav.documents, icon: FolderLock },
      ],
    },
    {
      title: t.nav.moreSection,
      items: [
        { to: '/what-if', label: t.nav.whatIf, icon: FlaskConical },
        { to: '/caregraph', label: t.nav.careGraph, icon: Network },
        { to: '/notifications', label: t.nav.notifications, icon: Bell },
        { to: '/activity', label: t.nav.activity, icon: History },
      ],
    },
  ];
}

/**
 * Two halves, matching how Hearth is used: "Me" is one person's own day,
 * "Family" is what they share with the people around them.
 */
export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Me',
    items: [
      { to: '/today', label: 'My day', icon: Sun },
      { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
      { to: '/tasks', label: 'Tasks', icon: CircleCheckBig },
      { to: '/plan', label: 'Plan my week', icon: Sparkles },
      { to: '/schedule', label: 'Schedule', icon: CalendarDays },
      { to: '/health', label: 'Health & food', icon: HeartPulse, end: true },
      { to: '/health/medicines', label: 'Medicines', icon: Pill },
    ],
  },
  {
    title: 'Family',
    items: [
      { to: '/family', label: 'Family hub', icon: Users },
      { to: '/chat', label: 'Family chat', icon: MessagesSquare },
      { to: '/priority', label: 'Handovers', icon: ListOrdered },
      { to: '/groceries', label: 'Shopping list', icon: ShoppingBasket },
      { to: '/appointments', label: 'Appointments', icon: Stethoscope },
      { to: '/documents', label: 'Documents', icon: FolderLock },
    ],
  },
  {
    title: 'More',
    items: [
      { to: '/what-if', label: 'What-if planner', icon: FlaskConical },
      { to: '/caregraph', label: 'Family map', icon: Network },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/activity', label: 'Activity', icon: History },
    ],
  },
];
