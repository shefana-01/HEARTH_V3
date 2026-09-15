import React from 'react';
import { ProfileHeader } from './components/ProfileHeader';
import { ProfileNavTabs } from './components/ProfileNavTabs';
import { CaregiverCard } from './components/CaregiverCard';
import { StatusMessageCard } from './components/StatusMessageCard';
import { PersonalInfoSection } from './components/PersonalInfoSection';
import { PreferencesSection } from './components/PreferencesSection';
import { ProfileFooter } from './components/ProfileFooter';

export const ProfilePage: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#fff8f4] text-[#201b15] antialiased flex flex-col justify-between selection:bg-[#c5ecd1] selection:text-[#002112]">
      {/* Fixed App Header */}
      <div>
        <ProfileHeader currentFamilyName="The Miller Family" />
        <div className="pt-16">
          <ProfileNavTabs />
        </div>
      </div>

      {/* Main Settings Body */}
      <main className="w-full flex-1 bg-[#fff8f4] py-8 sm:py-10">
        <div className="max-w-4xl mx-auto w-full px-4 md:px-8 lg:px-12">
          {/* Top Heading Block */}
          <div className="mb-8">
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-[#56423c]/70 mb-1.5 block">
              Personal Workspace
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#201b15] font-normal tracking-tight">
              Profile &amp; Personal Details
            </h1>
            <p className="font-sans text-sm sm:text-base text-[#56423c] mt-2 max-w-2xl leading-relaxed">
              Manage your personal identity, visibility, and secure contact preferences within the Hearth care network.
            </p>
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Avatar & Quick Status */}
            <div className="md:col-span-1 flex flex-col gap-6">
              <CaregiverCard />
              <StatusMessageCard />
            </div>

            {/* Right Column: Information & Preferences Lists */}
            <div className="md:col-span-2 flex flex-col gap-6">
              <PersonalInfoSection />
              <PreferencesSection />
            </div>
          </div>
        </div>
      </main>

      {/* HIPAA Compliance Footer */}
      <ProfileFooter />
    </div>
  );
};
