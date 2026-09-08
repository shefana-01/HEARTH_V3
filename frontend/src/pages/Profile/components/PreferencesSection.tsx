import React from 'react';

export const PreferencesSection: React.FC = () => {
  return (
    <div className="bg-[#fdf2e8] rounded-2xl shadow-xs overflow-hidden border border-[#ece1d7]/60">
      <div className="px-6 py-4 bg-[#f1e6dc]/40 border-b border-[#ece1d7]/40">
        <h3 className="font-sans text-base sm:text-lg font-bold text-[#201b15]">
          Preferences &amp; Security
        </h3>
      </div>

      <div className="divide-y divide-[#ece1d7]/40">
        {/* Care Circle Privacy Row */}
        <div className="p-5 flex items-center justify-between hover:bg-[#f7ece2]/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f1e6dc] flex items-center justify-center text-[#201b15] shrink-0">
              <span className="material-symbols-outlined text-[20px]">lock</span>
            </div>
            <div>
              <span className="font-sans text-xs font-semibold text-[#201b15] block">
                Care Circle Privacy
              </span>
              <span className="font-sans text-sm text-[#56423c]">
                Control who sees your active status and notes
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#56423c] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>

        {/* Alerts & Notifications Row */}
        <div className="p-5 flex items-center justify-between hover:bg-[#f7ece2]/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f1e6dc] flex items-center justify-center text-[#201b15] shrink-0">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <div>
              <span className="font-sans text-xs font-semibold text-[#201b15] block">
                Alerts &amp; Notifications
              </span>
              <span className="font-sans text-sm text-[#56423c]">
                Medication reminders and family check-in chimes
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#56423c] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>

        {/* Account & Data Export Row */}
        <div className="p-5 flex items-center justify-between hover:bg-[#f7ece2]/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#ffdad6]/60 flex items-center justify-center text-[#ba1a1a] shrink-0">
              <span className="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div>
              <span className="font-sans text-xs font-semibold text-[#201b15] block">
                Account &amp; Data Export
              </span>
              <span className="font-sans text-sm text-[#56423c]">
                Download encrypted records or deactivate profile
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#56423c] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>
      </div>
    </div>
  );
};
