import { Bell, CalendarDays, CircleCheckBig, FlaskConical, FolderLock, History, LayoutDashboard, ListOrdered, Network, Salad, Stethoscope, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Coordinate',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/tasks', label: 'Tasks', icon: CircleCheckBig },
      { to: '/schedule', label: 'Schedule & availability', icon: CalendarDays },
      { to: '/priority', label: 'Priority center', icon: ListOrdered },
      { to: '/what-if', label: 'What-if simulator', icon: FlaskConical },
    ],
  },
  {
    title: 'Care',
    items: [
      { to: '/caregraph', label: 'CareGraph', icon: Network },
      { to: '/appointments', label: 'Appointments', icon: Stethoscope },
      { to: '/nutrition', label: 'Nutrition & groceries', icon: Salad },
      { to: '/documents', label: 'Documents', icon: FolderLock },
    ],
  },
  {
    title: 'Circle',
    items: [
      { to: '/family', label: 'Family circle', icon: Users },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/activity', label: 'Activity & audit', icon: History },
    ],
  },
];
