import React from 'react';
import { Link } from 'react-router-dom';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative w-full pt-12 pb-20 lg:pt-16 lg:pb-28">
      {/* Ambient Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-gradient-to-tr from-[#ffdad8]/40 via-[#f7e5d0]/30 to-[#d7e8de]/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Hero Copy */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            {/* Crisp Badge */}
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-[#d7e8de]/80 border border-[#8fa89b]/30 text-[#52695e] text-xs font-semibold tracking-wide">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Intelligent Family Care Coordination</span>
            </div>

            {/* Headline */}
            <h1 className="font-serif font-semibold text-4xl sm:text-5xl lg:text-[54px] text-[#2d2522] leading-[1.18] tracking-tight">
              Caring for the ones you love shouldn’t feel like running a hospital alone.
            </h1>

            {/* Supporting copy */}
            <p className="text-lg sm:text-xl text-[#5a4a46] font-normal leading-relaxed max-w-2xl">
              Hearth coordinates medications, appointments, rides, and daily care across the entire family circle — with zero clinical confusion and total privacy.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-2xl bg-[#b86b69] hover:bg-[#a35b5a] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all active:scale-[0.99] gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">family_restroom</span>
                <span>Get Started Free</span>
              </Link>
              <a
                href="#caregraph"
                className="inline-flex items-center justify-center min-h-[54px] px-7 rounded-2xl bg-white hover:bg-[#fcebe5] border border-[#ddcbca]/70 text-[#2d2522] font-semibold text-base shadow-xs hover:shadow transition-all gap-2"
              >
                <span className="material-symbols-outlined text-[22px] text-[#52695e]">
                  play_circle
                </span>
                <span>See How Hearth Works</span>
              </a>
            </div>

            {/* Sub-notes */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 pt-3 text-xs sm:text-sm text-[#5a4a46] font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8fa89b]" />
                No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8fa89b]" />
                Built for multi-generational families
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8fa89b]" />
                HIPAA compliant
              </span>
            </div>
          </div>

          {/* Hero UI Preview Card: Hearth Synchronization Snapshot */}
          <div className="lg:col-span-5">
            <div className="relative bg-white p-6 sm:p-7 rounded-3xl shadow-xl shadow-[#ecd7ce]/50 border border-[#f5dfd7]">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#fcebe5]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ffdad8] flex items-center justify-center text-[#b86b69] font-serif font-semibold text-sm">
                    RH
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-base text-[#2d2522]">
                      Shefana’s Hearth
                    </h3>
                    <p className="text-xs text-[#5a4a46]">Today · Morning Circle Synchronized</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d7e8de] text-[#52695e] text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#52695e] animate-pulse" />
                  Zero Conflicts
                </span>
              </div>

              {/* Snapshot Schedule List */}
              <div className="space-y-3.5 my-5">
                {/* Item 1: Verified Medication */}
                <div className="p-3.5 rounded-2xl bg-[#fff1ec] border border-[#fcebe5] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#d7e8de] flex items-center justify-center text-[#52695e]">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#52695e]">8:30 AM · Verified</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fcebe5] text-[#5a4a46] font-medium">
                          Dad confirmed
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#2d2522]">Morning Lisinopril &amp; Water</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#52695e] text-[20px]">verified</span>
                </div>

                {/* Item 2: Claimed Afternoon Task */}
                <div className="p-3.5 rounded-2xl bg-[#fff1ec] border border-[#fcebe5] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f7e5d0] flex items-center justify-center text-[#8c6239]">
                      <span className="material-symbols-outlined text-[20px]">directions_walk</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#8c6239]">4:00 PM · Claimed</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4a373]/20 text-[#8c6239] font-medium">
                          Maya (Daughter)
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#2d2522]">Courtyard Walk &amp; BP Reading</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#5a4a46] font-medium">On Track</span>
                </div>

                {/* Item 3: Auto-balanced Pantry Suggestion */}
                <div className="p-3.5 rounded-2xl bg-[#fff1ec] border border-[#fcebe5] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#ffdad8] flex items-center justify-center text-[#b86b69]">
                      <span className="material-symbols-outlined text-[20px]">nutrition</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#b86b69]">Dinner Protocol</span>
                      <p className="text-sm font-semibold text-[#2d2522]">Low-Sodium Vegetable Broth</p>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#fcebe5] text-[#5a4a46] font-medium">
                    Auto-Synced
                  </span>
                </div>
              </div>

              {/* Interactive Micro-trigger */}
              <div className="pt-2 flex items-center justify-between text-xs text-[#5a4a46] bg-[#fcebe5]/60 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#52695e] text-[18px]">
                    family_restroom
                  </span>
                  <span>4 members connected</span>
                </div>
                <span className="font-semibold text-[#b86b69]">Calm Cadence Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
