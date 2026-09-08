import React from 'react';

export const SecurityAffirmation: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-2 text-center pt-1">
      <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-[#edf6f1] border border-[#d1e5d9]">
        <span className="material-symbols-outlined text-[18px] text-[#285740]">
          verified_user
        </span>
        <span className="font-sans text-xs font-semibold text-[#285740]">
          Quiet, Protected Sanctuary
        </span>
      </div>
      <p className="font-sans text-xs text-[#6a5e58] max-w-[460px] leading-relaxed">
        Encrypted with 256-bit AES ΓÇó Strict role-based family privacy ΓÇó HIPAA compliant
      </p>
    </div>
  );
};
