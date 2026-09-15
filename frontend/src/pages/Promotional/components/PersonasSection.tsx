import React from 'react';

const PERSONAS = [
  {
    emoji: '👴',
    badgeBg: '#f7e5d0',
    title: 'The Elder',
    name: 'Grandfather Abdul (Age 75)',
    description: 'Designed specifically for tablets on the bedside table. Never intimidating, never clinical.',
    features: [
      { icon: 'format_size', text: 'Extra-large 24px high contrast typography' },
      { icon: 'touch_app', text: '1-Tap "I Have Taken These" big buttons' },
      { icon: 'volume_up', text: 'Natural soothing voice reading' },
    ],
    footer: 'Dignity & independence preserved',
    footerColor: '#8c6239',
  },
  {
    emoji: '👩',
    badgeBg: '#ffdad8',
    title: 'The Coordinator',
    name: 'Afsara (Age 23, Daughter)',
    description: 'Carries the big picture without having to hold every single detail in her head 24/7.',
    features: [
      { icon: 'overview', text: 'High-level peace-of-mind dashboard' },
      { icon: 'auto_fix_high', text: 'Automated sibling workload balancing' },
      { icon: 'fact_check', text: 'Medication compliance tracking' },
    ],
    footer: 'Relieves silent caregiver burnout',
    footerColor: '#b86b69',
  },
  {
    emoji: '👨',
    badgeBg: '#d7e8de',
    title: 'Working Sibling',
    name: 'Rafid (Age 21, Son)',
    description: 'Wants to help meaningfully between business meetings and daily rush-hour transit.',
    features: [
      { icon: 'notifications_paused', text: '15-minute quick logistics pings' },
      { icon: 'alt_route', text: 'Route-aware clinic pickup alerts' },
      { icon: 'swap_horiz', text: 'Instant errand hand-offs' },
    ],
    footer: 'Empowered to contribute seamlessly',
    footerColor: '#52695e',
  },
  {
    emoji: '👧',
    badgeBg: '#ffedea',
    title: 'The Teen',
    name: 'Mayra (Age 16, Granddaughter)',
    description: 'Connects with grandpa with lighthearted love, free from intimidating clinical duties.',
    features: [
      { icon: 'sentiment_satisfied', text: 'Gentle emoji & photo check-ins' },
      { icon: 'cookie', text: 'Homework & grandpa tea-time reminders' },
      { icon: 'volunteer_activism', text: 'Bite-sized companionship tasks' },
    ],
    footer: 'Multi-generational bonding made warm',
    footerColor: '#8c6239',
  },
];

export const PersonasSection: React.FC = () => {
  return (
    <section className="w-full py-20 lg:py-28 max-w-7xl mx-auto px-5 sm:px-8" id="for-families">
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
        <span className="text-xs font-bold uppercase tracking-widest text-[#b86b69]">
          Human Experience Design
        </span>
        <h2 className="font-serif font-semibold text-3xl sm:text-4xl lg:text-5xl text-[#2d2522]">
          One coordination system. Tailored for every family member.
        </h2>
        <p className="text-base sm:text-lg text-[#5a4a46] leading-relaxed">
          Care feels natural only when everyone feels heard, capable, and never overwhelmed by complex tech.
        </p>
      </div>

      {/* 4 Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PERSONAS.map((persona, idx) => (
          <div
            key={idx}
            className="p-6 rounded-3xl bg-white border border-[#fcebe5] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-serif font-bold text-xl"
                  style={{ backgroundColor: persona.badgeBg }}
                >
                  {persona.emoji}
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-lg text-[#2d2522]">{persona.title}</h3>
                  <p className="text-xs text-[#5a4a46]">{persona.name}</p>
                </div>
              </div>

              <p className="text-sm text-[#5a4a46] leading-relaxed">{persona.description}</p>

              <div className="space-y-2 pt-2 text-xs">
                {persona.features.map((feature, fIdx) => (
                  <div
                    key={fIdx}
                    className="p-2.5 rounded-xl bg-[#fff1ec] flex items-center gap-2 text-[#2d2522]"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#52695e]">
                      {feature.icon}
                    </span>
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="pt-6 border-t border-[#fcebe5] mt-6 text-xs font-semibold"
              style={{ color: persona.footerColor }}
            >
              {persona.footer}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
