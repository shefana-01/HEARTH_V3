import React from 'react';

export const IntegrationsCard: React.FC = () => {
  return (
    <div className="relative bg-white w-64 sm:w-72 p-5 rounded-3xl transform rotate-3 card-shadow-heavy border border-white pointer-events-auto">
      {/* Card Title */}
      <h3 className="text-[16px] font-bold text-[#141A21] mb-4">100+ Integrations</h3>

      {/* App Icons Container */}
      <div className="relative flex items-center justify-center h-20 pt-1">
        {/* Gmail / Mail icon card */}
        <div className="absolute left-1 z-10 w-14 h-14 bg-white rounded-2xl icon-shadow border border-slate-100 flex items-center justify-center transform -rotate-6 hover:scale-105 transition-transform duration-200">
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path d="M3 6.5V18a2 2 0 002 2h2V9.8L3 6.5z" fill="#4285F4" />
            <path d="M17 20h2a2 2 0 002-2V6.5l-4 3.3V20z" fill="#34A853" />
            <path d="M17 6.5l-5 4-5-4V5a2 2 0 013.2-1.6L12 4.6l1.8-1.2A2 2 0 0117 5v1.5z" fill="#EA4335" />
            <path d="M7 9.8V20h10V9.8l-5 4-5-4z" fill="#FBBC04" opacity="0.1" />
          </svg>
        </div>

        {/* Slack icon card */}
        <div className="relative z-20 w-16 h-16 bg-white rounded-2xl icon-shadow border border-slate-100 flex items-center justify-center transform rotate-2 hover:scale-105 transition-transform duration-200">
          <svg className="w-9 h-9" viewBox="0 0 24 24">
            <path d="M5.5 10.5a2 2 0 100-4 2 2 0 000 4zm2.5-2a2 2 0 00-2-2H2v2a2 2 0 002 2h4z" fill="#E01E5A" />
            <path d="M10.5 5.5a2 2 0 10-4 0 2 2 0 004 0zm-2 2.5a2 2 0 00-2-2V2h2a2 2 0 002 2v4z" fill="#36C5F0" />
            <path d="M18.5 13.5a2 2 0 100 4 2 2 0 000-4zm-2.5 2a2 2 0 002 2H22v-2a2 2 0 00-2-2h-4z" fill="#2EB67D" />
            <path d="M13.5 18.5a2 2 0 104 0 2 2 0 00-4 0zm2-2.5a2 2 0 002 2V22h-2a2 2 0 00-2-2v-4z" fill="#ECB22E" />
          </svg>
        </div>

        {/* Google Calendar '31' icon card */}
        <div className="absolute right-1 z-10 w-14 h-14 bg-white rounded-2xl icon-shadow border border-slate-100 flex items-center justify-center transform rotate-8 hover:scale-105 transition-transform duration-200">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 flex flex-col items-center justify-center bg-white">
            <div className="w-full h-2.5 bg-[#4285F4]" />
            <span className="text-[12px] font-bold text-[#1E293B] leading-none mt-1">31</span>
          </div>
        </div>
      </div>
    </div>
  );
};
