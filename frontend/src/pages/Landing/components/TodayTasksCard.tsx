import React from 'react';

export const TodayTasksCard: React.FC = () => {
  return (
    <div className="relative bg-white w-72 sm:w-80 p-5 rounded-3xl transform -rotate-3 card-shadow-heavy border border-white pointer-events-auto">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[17px] font-bold text-[#141A21]">Today's tasks</h3>
      </div>

      {/* Task 1 */}
      <div className="bg-[#FFF8F3] rounded-2xl p-3.5 mb-3 border border-[#FBEADA]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3.5 h-3.5 rounded bg-[#E48766] inline-block shrink-0" />
          <span className="text-[13px] font-semibold text-[#1F2937] truncate">New ideas for campaign</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
          <span>Sep 10</span>
          <div className="flex-1 bg-white h-2 rounded-full overflow-hidden border border-orange-100">
            <div className="bg-[#E48766] h-full rounded-full transition-all duration-500" style={{ width: '60%' }} />
          </div>
          <span className="text-[11px] font-bold text-slate-700">60%</span>
        </div>
      </div>

      {/* Task 2 */}
      <div className="bg-[#F4F7FA] rounded-2xl p-3.5 border border-[#E3EBF3]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3.5 h-3.5 rounded bg-[#5A7489] inline-block shrink-0" />
          <span className="text-[13px] font-semibold text-[#1F2937] truncate">Design PPT</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
          <span>Sep 19</span>
          <div className="flex-1 bg-white h-2 rounded-full overflow-hidden border border-slate-200">
            <div className="bg-[#5A7489] h-full rounded-full transition-all duration-500" style={{ width: '100%' }} />
          </div>
          <span className="text-[11px] font-bold text-slate-700">112%</span>
        </div>
      </div>
    </div>
  );
};
