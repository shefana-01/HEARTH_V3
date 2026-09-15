import React from 'react';

export const ProfileFooter: React.FC = () => {
  return (
    <footer className="w-full bg-[#fdf2e8] mt-12 border-t border-[#ece1d7]/60">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Compliance guarantee */}
        <div className="flex items-center gap-2 text-[#56423c] font-sans text-xs sm:text-sm">
          <span className="material-symbols-outlined text-[#3b5d77] text-[18px]">
            verified_user
          </span>
          <span>HIPAA-Compliant Encrypted Family Workspace</span>
        </div>

        {/* Footer Links */}
        <div className="flex items-center gap-6 font-sans text-xs text-[#56423c]">
          <a href="#privacy-notice" className="hover:text-[#201b15] transition-colors">
            Care Privacy Notice
          </a>
          <a href="#consent-terms" className="hover:text-[#201b15] transition-colors">
            Consent Terms
          </a>
          <a href="#audit-logs" className="hover:text-[#201b15] transition-colors">
            Clinician Audit Logs
          </a>
        </div>
      </div>
    </footer>
  );
};
