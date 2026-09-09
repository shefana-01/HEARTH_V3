import React from 'react';

export const StickyNoteCard: React.FC = () => {
  return (
    <div className="relative pointer-events-auto">
      {/* Kraft Post-it note with pin */}
      <div className="relative w-56 sm:w-60 bg-[#E8C5AC] p-5 rounded-2xl transform -rotate-3 card-shadow border border-[#DFBBA0]/60">
        {/* Silver Push Pin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4">
          <div className="w-3.5 h-3.5 rounded-full bg-slate-500 shadow-md border border-slate-400 mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-slate-200 absolute top-0.5 left-1 opacity-70" />
        </div>
        <p className="font-handwritten text-[#3D281F] text-[19px] sm:text-[21px] leading-[1.35] tracking-wide pt-1">
          Take notes to keep track of crucial details, and accomplish more tasks with ease.
        </p>
      </div>

      {/* Frosted Checkmark Pill floating over note */}
      <div className="absolute -bottom-10 -left-6 transform -rotate-12 bg-white/70 backdrop-blur-md p-4 rounded-3xl card-shadow border border-white/90 w-24 h-24 flex items-center justify-center">
        <div className="w-12 h-12 bg-[#3B82F6] rounded-2xl p-2.5 flex items-center justify-center shadow-sm">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
            <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};
