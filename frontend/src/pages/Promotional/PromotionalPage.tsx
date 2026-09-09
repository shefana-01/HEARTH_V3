import React from 'react';
import { HearthNavbar } from './components/HearthNavbar';
import { HeroSection } from './components/HeroSection';
import { CaregivingDilemmaSection } from './components/CaregivingDilemmaSection';
import { CareGraphPipelineSection } from './components/CareGraphPipelineSection';
import { DecisionEngineSection } from './components/DecisionEngineSection';
import { PersonasSection } from './components/PersonasSection';
import { PrivacyTrustSection } from './components/PrivacyTrustSection';
import { FinalEmotionalCtaSection } from './components/FinalEmotionalCtaSection';
import { HearthFooter } from './components/HearthFooter';

export const PromotionalPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#fff8f6] font-sans text-[#2d2522] antialiased selection:bg-[#b86b69]/20 selection:text-[#b86b69] scroll-smooth">
      {/* 1. Header & Top Navigation */}
      <HearthNavbar />

      {/* Main Content Sections */}
      <main className="w-full pt-20 overflow-x-hidden">
        {/* 2. Hero Section with Live Snapshot */}
        <HeroSection />

        {/* 3. The Caregiving Dilemma & 5 Silos */}
        <CaregivingDilemmaSection />

        {/* 4. The CareGraph™ 6-Stage Pipeline */}
        <CareGraphPipelineSection />

        {/* 5. Proactive Decision Engine Simulation */}
        <DecisionEngineSection />

        {/* 6. Multi-Generational Personas */}
        <PersonasSection />

        {/* 7. Sanctuary of Care & Privacy Pillars */}
        <PrivacyTrustSection />

        {/* 8. Final Emotional CTA & Caregiver Testimonial */}
        <FinalEmotionalCtaSection />
      </main>

      {/* 9. Comprehensive Platform Footer */}
      <HearthFooter />
    </div>
  );
};
