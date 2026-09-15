import React, { useState } from 'react';

const TABS = [
  { id: 'profile', label: 'Profile & Personal Details' },
  { id: 'permissions', label: 'Care Circle Permissions' },
  { id: 'security', label: 'Security & Trust' },
  { id: 'notifications', label: 'Care Alerts & Reminders' },
  { id: 'clinical', label: 'Clinical Records & Export' },
];

export const ProfileNavTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <nav className="border-t border-[#ece1d7] bg-white/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 flex items-center gap-6 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 font-sans text-xs sm:text-sm whitespace-nowrap transition-all border-b-2 font-medium cursor-pointer ${
                isActive
                  ? 'text-[#983d1d] font-semibold border-[#983d1d]'
                  : 'text-[#56423c] border-transparent hover:text-[#201b15]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
