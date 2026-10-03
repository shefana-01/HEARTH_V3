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
  ShoppingBasket,
  Stethoscope,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
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
      { to: '/tasks', label: 'Tasks', icon: CircleCheckBig },
      { to: '/schedule', label: 'Schedule', icon: CalendarDays },
      { to: '/health', label: 'Health & food', icon: HeartPulse },
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
