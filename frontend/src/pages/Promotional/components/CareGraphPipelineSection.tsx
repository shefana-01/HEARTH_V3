import React from 'react';

const STEPS = [
  {
    step: 1,
    tag: 'Care Need',
    icon: 'favorite',
    iconColor: '#b86b69',
    title: 'Stage 2 Hypertension',
    description: "Doctor updates father's care directive following routine cardiology clinic review.",
    badge: 'Source: Dr. Chen notes',
  },
  {
    step: 2,
    tag: 'Clinical Protocol',
    icon: 'medication',
    iconColor: '#8c6239',
    title: 'Dosing & Nutrition',
    description: 'Converted into low-sodium menu guidelines and daily 8:30 AM Lisinopril medication prompt.',
    badge: 'Auto-plain language',
  },
  {
    step: 3,
    tag: 'Grocery & Pantry',
    icon: 'shopping_basket',
    iconColor: '#52695e',
    title: 'Household Sync',
    description: 'Potassium-rich greens & low-sodium bone broth auto-added to the family shopping list.',
    badge: 'Zero grocery guesswork',
  },
  {
    step: 4,
    tag: 'Daily Rhythm',
    icon: 'directions_walk',
    iconColor: '#8c6239',
    title: 'Courtyard Walk',
    description: 'Generates a 20-minute gentle afternoon walk + post-walk blood pressure verification task.',
    badge: 'Tactile check-in',
  },
  {
    step: 5,
    tag: 'Family Assignment',
    icon: 'person_check',
    iconColor: '#52695e',
    title: 'Assigned to Rafid',
    description: "Smart matcher syncs with Rafid's open calendar block, adding a 15-minute commute buffer.",
    badge: '98% availability match',
  },
  {
    step: 6,
    tag: 'Peace of Mind',
    icon: 'task_alt',
    iconColor: '#52695e',
    title: '1-Tap Completion',
    description: 'Robert and Rafid tap complete; entire family circle is softly updated without noisy group pings.',
    badge: 'Circle Notified',
    badgeIcon: 'done_all',
    highlightBorder: true,
  },
];

export const CareGraphPipelineSection: React.FC = () => {
  return (
    <section className="w-full py-20 lg:py-28 max-w-7xl mx-auto px-5 sm:px-8" id="caregraph">
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
        <span className="text-xs font-bold uppercase tracking-widest text-[#52695e]">
          Seamless Pipeline
        </span>
        <h2 className="font-serif font-semibold text-3xl sm:text-4xl lg:text-5xl text-[#2d2522]">
          How Hearth Works: The CareGraph™
        </h2>
        <p className="text-base sm:text-lg text-[#5a4a46] leading-relaxed">
          Every medical directive naturally connects to everyday household action.
        </p>
      </div>

      {/* 6-Step Visual Cascade / Pipeline */}
      <div className="relative">
        {/* Subtle Connection Line on Desktop */}
        <div className="hidden lg:block absolute top-1/2 left-4 right-4 h-1 bg-gradient-to-r from-[#ffdad8] via-[#f7e5d0] to-[#d7e8de] -translate-y-1/2 -z-10 rounded-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
          {STEPS.map((item) => (
            <div
              key={item.step}
              className={`bg-white p-5 rounded-2xl border ${
                item.highlightBorder ? 'border-[#8fa89b]' : 'border-[#fcebe5]'
              } shadow-xs flex flex-col justify-between hover:shadow-md transition-all`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center ${
                      item.step === 6 ? 'bg-[#52695e]' : 'bg-[#b86b69]'
                    }`}
                  >
                    {item.step}
                  </span>
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: item.iconColor }}
                  >
                    {item.icon}
                  </span>
                </div>
                <span className="text-[11px] uppercase font-semibold tracking-wider text-[#5a4a46]">
                  {item.tag}
                </span>
                <h3 className="font-serif font-semibold text-base text-[#2d2522] mt-1 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-[#5a4a46] leading-relaxed">{item.description}</p>
              </div>

              {item.badgeIcon ? (
                <div className="mt-4 pt-3 border-t border-[#fcebe5] text-[11px] text-[#52695e] font-semibold bg-[#d7e8de]/60 p-2 rounded-xl flex items-center justify-between">
                  <span>{item.badge}</span>
                  <span className="material-symbols-outlined text-[16px]">{item.badgeIcon}</span>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-[#fcebe5] text-[11px] text-[#2d2522] font-medium bg-[#fff1ec] p-2 rounded-xl">
                  {item.badge}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
