import React from 'react';
import { LandingNavbar } from './components/LandingNavbar';
import { HeroCenter } from './components/HeroCenter';
import { StickyNoteCard } from './components/StickyNoteCard';
import { RemindersCard } from './components/RemindersCard';
import { TodayTasksCard } from './components/TodayTasksCard';
import { IntegrationsCard } from './components/IntegrationsCard';

export const LandingPage: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#E7F4EF] via-[#E8F3EE] to-[#E2EFE9] text-[#1E242B] font-sans antialiased selection:bg-blue-100 selection:text-blue-700">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-80 bg-dot-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-12 right-28 w-80 h-80 rounded-full bg-[#CCE9DC] opacity-75 blur-2xl pointer-events-none" />

      {/* Small scattered accent dots */}
      <div className="absolute top-44 left-16 w-4 h-4 rounded-full bg-[#E08A69] opacity-80 pointer-events-none" />
      <div className="absolute bottom-36 left-24 w-3 h-3 rounded-full bg-[#E79F84] opacity-85 pointer-events-none" />
      <div className="absolute bottom-52 right-24 w-3.5 h-3.5 rounded-full bg-[#A2CEBC] pointer-events-none" />

      {/* Navigation Bar */}
      <LandingNavbar />

      {/* Main Hero Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 max-w-7xl mx-auto w-full">
        {/* Center Circular Backdrop & Content */}
        <HeroCenter />

        {/* FloatingCardTopLeft (Sticky Note & Checkbox) */}
        <div className="hidden lg:block absolute top-8 left-4 md:top-12 md:left-14 lg:left-24 z-20 pointer-events-auto">
          <StickyNoteCard />
        </div>

        {/* FloatingCardTopRight (Reminders & Clock) */}
        <div className="hidden lg:block absolute top-10 right-4 md:top-14 md:right-12 lg:right-24 z-20 pointer-events-auto">
          <RemindersCard />
        </div>

        {/* FloatingCardBottomLeft (Today's Tasks) */}
        <div className="hidden lg:block absolute bottom-6 left-2 md:bottom-10 md:left-14 lg:left-24 z-20 pointer-events-auto">
          <TodayTasksCard />
        </div>

        {/* FloatingCardBottomRight (100+ Integrations) */}
        <div className="hidden lg:block absolute bottom-6 right-2 md:bottom-10 md:right-12 lg:right-24 z-20 pointer-events-auto">
          <IntegrationsCard />
        </div>
      </main>

      {/* Responsive Grid for Mobile / Tablets (when floating cards are hidden) */}
      <div className="lg:hidden px-6 pb-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto w-full z-20">
        <div className="flex justify-center">
          <StickyNoteCard />
        </div>
        <div className="flex justify-center">
          <RemindersCard />
        </div>
        <div className="flex justify-center">
          <TodayTasksCard />
        </div>
        <div className="flex justify-center">
          <IntegrationsCard />
        </div>
      </div>

      {/* Page Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 select-none z-10">
        ┬⌐ ChronoTask Inc. All rights reserved.
      </footer>
    </div>
  );
};
