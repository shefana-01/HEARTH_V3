import React from 'react';

export const RemindersCard: React.FC = () => {
  return (
    <div className="relative pointer-events-auto">
      {/* Reminders Card */}
      <div className="relative bg-white w-64 p-5 rounded-3xl transform rotate-6 card-shadow border border-white/90">
        {/* Tab header */}
        <div className="flex items-center justify-between pb-3">
          <span className="text-[17px] font-bold text-[#141A21]">Reminders</span>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Meetings</span>
        </div>

        {/* Reminder Item */}
        <div className="bg-[#F8FAFC] rounded-2xl p-3 border border-slate-100/80">
          <p className="text-[13px] font-bold text-[#1F2937]">Today's Meeting</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Call with marketing team</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Time</span>
            <div className="inline-flex items-center gap-1 bg-[#E8F0FE] text-[#2563EB] text-[11px] font-semibold px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>13:00 - 13:45</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Stopwatch Icon */}
      <div className="absolute -left-10 top-4 transform -rotate-6 bg-white p-3.5 rounded-2xl icon-shadow border border-white/90 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-[#1E293B]"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="13" r="8" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="14.5" y1="13" y2="14.5" />
          <path d="M12 2v3" />
          <path d="M10 2h4" />
        </svg>
      </div>
    </div>
  );
};
