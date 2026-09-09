import React from 'react';

const PILLARS = [
  {
    icon: 'tune',
    iconBg: '#d7e8de',
    iconColor: '#52695e',
    title: 'Permission-Aware Scoping',
    description:
      'Grandkids see ride requests and tea visits; only designated guardians access lab results and medical directives.',
    badge: 'Granular family roles',
    badgeIcon: 'verified_user',
  },
  {
    icon: 'no_accounts',
    iconBg: '#ffdad8',
    iconColor: '#b86b69',
    title: 'Zero Data Monetization',
    description:
      'We never sell, analyze for third parties, or broker family health information. Zero pharmaceutical advertising.',
    badge: 'Family-funded integrity',
    badgeIcon: 'lock',
  },
  {
    icon: 'medical_services',
    iconBg: '#f7e5d0',
    iconColor: '#8c6239',
    title: '1-Tap Paramedic Vault',
    description:
      'Instantaneous, offline-accessible emergency sheet with DNR/proxy directives, allergy logs, and current doses for first responders.',
    badge: 'First-responder verified',
    badgeIcon: 'health_and_safety',
  },
  {
    icon: 'history_edu',
    iconBg: '#d7e8de',
    iconColor: '#52695e',
    title: 'HIPAA Audit Trail',
    description:
      'Every schedule swap and dosage check-off is 256-bit encrypted and permanently time-stamped for complete peace of mind.',
    badge: 'Bank-grade encryption',
    badgeIcon: 'security',
  },
];

export const PrivacyTrustSection: React.FC = () => {
  return (
    <section className="w-full py-20 bg-[#fff1ec]/80 border-t border-[#fcebe5]" id="privacy-trust">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#52695e]">
            Sanctuary of Care
          </span>
          <h2 className="font-serif font-semibold text-3xl sm:text-4xl lg:text-5xl text-[#2d2522]">
            Care coordination without giving up your family's privacy.
          </h2>
          <p className="text-base sm:text-lg text-[#5a4a46] leading-relaxed">
            Health data belongs strictly inside your family sanctuary. No advertisements, no data brokers, no clinical compromise.
          </p>
        </div>

        {/* 4 High-Trust Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PILLARS.map((pillar, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-white border border-[#fcebe5] shadow-xs hover:shadow-md transition-all space-y-3"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: pillar.iconBg, color: pillar.iconColor }}
              >
                <span className="material-symbols-outlined text-[26px]">{pillar.icon}</span>
              </div>
              <h3 className="font-serif font-semibold text-lg text-[#2d2522]">{pillar.title}</h3>
              <p className="text-sm text-[#5a4a46] leading-relaxed">{pillar.description}</p>
              <div
                className="pt-2 text-xs font-semibold flex items-center gap-1.5"
                style={{ color: pillar.iconColor }}
              >
                <span className="material-symbols-outlined text-[16px]">{pillar.badgeIcon}</span>
                <span>{pillar.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
