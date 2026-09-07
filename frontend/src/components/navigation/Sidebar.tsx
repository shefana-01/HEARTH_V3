import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  HeartPulse,
  Share2,
  CalendarDays,
  ShieldCheck,
  Settings,
  Sparkles,
} from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks & Planning', path: '/tasks', icon: CheckSquare },
  { name: 'Family Circle', path: '/family', icon: Users },
  { name: 'Care & Health', path: '/health', icon: HeartPulse },
  { name: 'CareGraph', path: '/caregraph', icon: Share2 },
  { name: 'What-If Scheduler', path: '/scheduler', icon: CalendarDays },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <span className="font-extrabold text-lg tracking-tight text-slate-900 block leading-tight">
            Hearth
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">
            Family Care V2.0
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Coordination Core
        </div>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm shadow-emerald-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>CareGraph Engine</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Hybrid event-driven decision scoring active. All reassignments require user approval.
        </p>
      </div>
    </aside>
  );
};
