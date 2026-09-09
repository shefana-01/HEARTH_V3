import React from 'react';

export const LoginFooter: React.FC = () => {
  return (
    <footer className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#52695e] z-20">
      <p className="font-sans text-xs sm:text-sm text-[#6e625c]">
        ┬⌐ Hearth Caregiving. Designed with quiet warmth and dignity.
      </p>
      <div className="flex items-center gap-4 sm:gap-6 font-sans text-xs">
        <a href="#privacy" className="transition-colors hover:underline text-[#554a45]">
          Privacy &amp; Dignity
        </a>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3d7259]" />
        <a href="#support" className="transition-colors hover:underline text-[#554a45]">
          Caregiver Support
        </a>
      </div>
    </footer>
  );
};
