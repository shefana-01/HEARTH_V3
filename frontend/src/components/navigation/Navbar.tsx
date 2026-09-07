import React from 'react';
import { Bell, Search } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export const Navbar: React.FC = () => {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 fixed top-0 right-0 left-64 z-20 px-8 flex items-center justify-between">
      {/* Search Bar */}
      <div className="flex items-center gap-3 w-96">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <Avatar name="User" role="Member" size="sm" />
          <div className="hidden md:block text-left">
            <span className="text-xs font-bold text-slate-800 block leading-tight">Hearth Workspace</span>
            <span className="text-[10px] text-emerald-600 font-medium">Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
};
