import React from 'react';

export const TrustBadges: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 text-[#534342] font-sans text-xs sm:text-sm">
      <span className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px] text-[#4c6358]">
          verified_user
        </span>
        HIPAA-aligned Security
      </span>
      <span className="hidden sm:inline text-slate-300">ΓÇó</span>
      <span className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px] text-[#8c4846]">
          volunteer_activism
        </span>
        Human Care First
      </span>
      <span className="hidden sm:inline text-slate-300">ΓÇó</span>
      <span className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px] text-[#7b542b]">
          lock
        </span>
        256-bit Encrypted
      </span>
    </div>
  );
};
