import React from 'react';

interface PasswordRequirementsProps {
  hasMinLength: boolean;
  hasNumOrSymbol: boolean;
  hasUppercase: boolean;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  hasMinLength,
  hasNumOrSymbol,
  hasUppercase,
}) => {
  return (
    <div className="p-3.5 rounded-xl bg-[#fff1ec] flex flex-col space-y-2 border border-[#faebe6]">
      <span className="font-sans text-xs font-semibold text-[#534342]">
        Password gentle requirements:
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Requirement 1: 8+ chars */}
        <div
          className={`flex items-center gap-1.5 transition-colors ${
            hasMinLength ? 'text-[#4c6358]' : 'text-[#534342]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[16px] transition-colors ${
              hasMinLength ? 'text-[#4c6358]' : 'text-[#867371]'
            }`}
          >
            check_circle
          </span>
          <span className="font-sans text-xs">8+ characters</span>
        </div>

        {/* Requirement 2: 1 number or symbol */}
        <div
          className={`flex items-center gap-1.5 transition-colors ${
            hasNumOrSymbol ? 'text-[#4c6358]' : 'text-[#534342]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[16px] transition-colors ${
              hasNumOrSymbol ? 'text-[#4c6358]' : 'text-[#867371]'
            }`}
          >
            check_circle
          </span>
          <span className="font-sans text-xs">1 number or symbol</span>
        </div>

        {/* Requirement 3: 1 uppercase letter */}
        <div
          className={`flex items-center gap-1.5 transition-colors ${
            hasUppercase ? 'text-[#4c6358]' : 'text-[#534342]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[16px] transition-colors ${
              hasUppercase ? 'text-[#4c6358]' : 'text-[#867371]'
            }`}
          >
            check_circle
          </span>
          <span className="font-sans text-xs">1 uppercase letter</span>
        </div>
      </div>
    </div>
  );
};
