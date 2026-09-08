import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface ProfileHeaderProps {
  currentFamilyName?: string;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  currentFamilyName = 'The Miller Family',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="fixed top-0 w-full z-50 bg-[#fff8f4]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#ece1d7]/60">
      <div className="h-16 max-w-7xl mx-auto px-4 md:px-8 lg:px-12 flex items-center justify-between gap-4">
        {/* Brand & Care Circle Selector */}
        <div className="flex items-center gap-4 shrink-0">
          <Link to="/" className="flex items-center gap-2 group focus:outline-none">
            <img
              alt="Hearth logo"
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              src="https://lh3.googleusercontent.com/aida/AEtjO1XrPZkbPZB8EcPSUh6Ny2pFadJr6wO1ohwPpeGgZolPDpJWSlu_KtQLauva4IxHnR0cA4KIDO-Q6POQ6sC9SDTR0NgxJUJ_8lZ1dHENxlqhvFw83Bd6KeSKnJ_pKtYm8Fpedk2sdrV1TKEEcxZuAC7kdLzQ5Qbu5yXI4B9131GoWk9IVlT7oUC5Q5P1K15U6rhByMLF8v7N1PhdUsqpSBSrsB3IhhWoiyLKJm9-UH02YcxXzF6hf3Jo"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="font-serif text-xl sm:text-2xl text-[#201b15] font-semibold tracking-tight">
              Hearth
            </span>
          </Link>

          <div className="h-5 w-px bg-[#ece1d7] hidden sm:block" />

          {/* Care Circle Dropdown Button */}
          <button
            type="button"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f7ece2] hover:bg-[#f1e6dc] text-[#201b15] transition-colors"
          >
            <span className="font-sans text-[11px] font-bold text-[#56423c] uppercase tracking-wider">
              Care Circle
            </span>
            <span className="font-sans text-sm font-semibold text-[#201b15]">
              {currentFamilyName}
            </span>
            <span className="material-symbols-outlined text-[#56423c] text-[18px]">
              unfold_more
            </span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#56423c] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medications, members, notes..."
              className="w-full pl-9 pr-4 py-1.5 bg-[#fdf2e8] rounded-lg font-sans text-xs sm:text-sm text-[#201b15] placeholder:text-[#56423c]/70 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#983d1d] transition-all border border-transparent focus:border-[#983d1d]"
            />
          </div>
        </div>

        {/* Action Controls & User Profile Pill */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Active Care Synced Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c5ecd1] text-[#496c57]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#436651]" />
            <span className="font-sans text-[11px] font-bold">Active Care Synced</span>
          </div>

          {/* Notifications Button */}
          <button
            type="button"
            aria-label="Notifications"
            className="p-2 rounded-lg text-[#56423c] hover:bg-[#f7ece2] hover:text-[#201b15] transition-colors relative"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#983d1d]" />
          </button>

          {/* Care Circle Settings */}
          <button
            type="button"
            aria-label="Care Circle Settings"
            className="p-2 rounded-lg text-[#56423c] hover:bg-[#f7ece2] hover:text-[#201b15] transition-colors hidden sm:block"
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
          </button>

          {/* User Profile Thumbnail */}
          <div className="flex items-center gap-1 pl-1 cursor-pointer">
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover shadow-xs border border-white"
              src="https://lh3.googleusercontent.com/aida/AEtjO1Uo24zAN1tDffK3lHQkD4yK2NepL2jXo8WsEQOaGJ9jWfxAQ3RRDvQkQBO4JJ74ICYxUG_OTbQ0IN1MVCRp1o7bnIVeUaefzFo_hizjwZgZp5ysrFnf-qGmZ4l-T6XYzpSFO5OlPRKmiPHO23wX_7nPO4DmoGM-PwrDby_6Nqq6weo7EcD1LpohajSq5xLQDDPet3O_mVzSF8H5KXS1xUZpYf0WFjmeFRrAaoTmaTvDlcsIYGoHnoLyAw"
            />
            <span className="material-symbols-outlined text-[#56423c] text-[16px] hidden sm:block">
              expand_more
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
