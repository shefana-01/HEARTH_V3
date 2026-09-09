import React from 'react';

const SILOS = [
  {
    icon: 'chat',
    iconBg: '#ffe6e4',
    iconColor: '#b44c33',
    title: 'Group Chats',
    description: (
      <>
        Buried messages like <em>“Did anyone give Dad his 8pm blood thinner or did we double-dose?”</em> lost in endless chatter.
      </>
    ),
    alertIcon: 'error',
    alertText: 'Easily missed alerts',
  },
  {
    icon: 'calendar_month',
    iconBg: '#fef2e2',
    iconColor: '#b45309',
    title: 'Work Calendars',
    description:
      'Double-booked clinic visits conflicting with unexpected office meetings and last-minute school runs.',
    alertIcon: 'event_busy',
    alertText: 'Scheduling clashes',
  },
  {
    icon: 'sticky_note_2',
    iconBg: '#fef8e6',
    iconColor: '#a16207',
    title: 'Sticky Notes & Fridge',
    description:
      'Outdated medication dosages, scribbled emergency numbers, and faded pharmacy receipts stuck to countertops.',
    alertIcon: 'visibility_off',
    alertText: 'Only visible at home',
  },
  {
    icon: 'folder_special',
    iconBg: '#f0f5ee',
    iconColor: '#52695e',
    title: 'Clinic Folders',
    description:
      'Dense discharge summaries filled with medical ICD-10 jargon that no family member can easily decipher.',
    alertIcon: 'lock_clock',
    alertText: 'Zero clear next steps',
  },
  {
    icon: 'psychology',
    iconBg: '#f6edee',
    iconColor: '#b86b69',
    title: 'Caregiver Memory',
    description:
      '95% of invisible coordination carried in the head of one exhausted sibling, leading directly to burnout.',
    alertIcon: 'sentiment_very_dissatisfied',
    alertText: 'Emotional exhaustion',
  },
];

export const CaregivingDilemmaSection: React.FC = () => {
  return (
    <section className="w-full py-20 bg-[#fff1ec]/70 border-y border-[#fcebe5]" id="the-problem">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#b86b69]">
            The Caregiving Dilemma
          </span>
          <h2 className="font-serif font-semibold text-3xl sm:text-4xl text-[#2d2522]">
            Care doesn't happen in one place.
          </h2>
          <p className="text-base sm:text-lg text-[#5a4a46] leading-relaxed">
            Today, family caregiving is fragmented across disconnected silos, creating cognitive overload and silent anxiety.
          </p>
        </div>

        {/* 5 Silo Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-12">
          {SILOS.map((silo, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white border border-[#fcebe5] hover:border-[#ddcbca]/90 transition-all shadow-xs hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: silo.iconBg, color: silo.iconColor }}
                >
                  <span className="material-symbols-outlined text-[24px]">{silo.icon}</span>
                </div>
                <h3 className="font-serif font-semibold text-base text-[#2d2522] mb-2">
                  {silo.title}
                </h3>
                <p className="text-sm text-[#5a4a46] leading-relaxed">{silo.description}</p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#fcebe5] text-xs text-[#ba1a1a] font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">{silo.alertIcon}</span>
                <span>{silo.alertText}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Resolution Banner */}
        <div className="max-w-3xl mx-auto p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#d7e8de] via-[#fcebe5] to-[#f7e5d0] text-center shadow-xs border border-[#8fa89b]/40">
          <div className="flex items-center justify-center gap-2.5 text-[#52695e] font-serif font-semibold text-lg sm:text-xl">
            <span className="material-symbols-outlined text-[24px]">sparkles</span>
            <span>Hearth brings the scattered pieces together into one calm, shared rhythm.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
