import React, { useState } from 'react';

export const DecisionEngineSection: React.FC = () => {
  const [simulationActive, setSimulationActive] = useState(false);

  const handleTestResolution = () => {
    setSimulationActive(true);
    setTimeout(() => {
      setSimulationActive(false);
    }, 4500);
  };

  return (
    <section className="w-full py-20 bg-[#fff1ec]/60 border-y border-[#fcebe5]" id="intelligent-loop">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#b86b69]">
            Proactive Decision Engine
          </span>
          <h2 className="font-serif font-semibold text-3xl sm:text-4xl lg:text-5xl text-[#2d2522]">
            When life changes, Hearth helps the family adapt.
          </h2>
          <p className="text-base sm:text-lg text-[#5a4a46] leading-relaxed">
            Not just another static calendar. An active decision engine that resolves care collisions before they become family crises.
          </p>
        </div>

        {/* Real-life crisis walkthrough card */}
        <div className="max-w-5xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-lg border border-[#f5dfd7]">
          {/* Trigger Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#fff0ed] border border-[#f5c7be] flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#b86b69] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#b86b69]">
                  Unforeseen Schedule Collision
                </span>
                <p className="text-sm sm:text-base font-semibold text-[#2d2522]">
                  Daughter cannot drive Grandfather to Cardiology Clinic (sudden work emergency at 2:00 PM).
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-[#ffdad8] text-[#b86b69] text-xs font-bold">
              Detected 4h Early
            </span>
          </div>

          {/* Step Indicators Walkthrough */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-[#fff1ec] border border-[#fcebe5] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#b86b69]">STEP 1</span>
                  <span className="material-symbols-outlined text-[#b86b69] text-[20px]">radar</span>
                </div>
                <h4 className="font-serif font-semibold text-sm text-[#2d2522] mb-1.5">
                  Conflict Detected
                </h4>
                <p className="text-xs text-[#5a4a46] leading-relaxed">
                  Hearth flags transit overlap 4 hours in advance, avoiding clinic missed-appointment penalties.
                </p>
              </div>
              <div className="mt-3 text-[11px] text-[#5a4a46] font-medium">Automatic alert</div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-[#fff1ec] border border-[#fcebe5] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#8c6239]">STEP 2</span>
                  <span className="material-symbols-outlined text-[#8c6239] text-[20px]">group_search</span>
                </div>
                <h4 className="font-serif font-semibold text-sm text-[#2d2522] mb-1.5">
                  Smart Candidate Match
                </h4>
                <p className="text-xs text-[#5a4a46] leading-relaxed">
                  Evaluates siblings' live availability, vehicle suitability (wheelchair trunk fit), and fatigue scores.
                </p>
              </div>
              <div className="mt-3 text-[11px] text-[#8c6239] font-medium">3 candidates analyzed</div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-[#fff1ec] border border-[#8fa89b]/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#52695e]">STEP 3</span>
                  <span className="material-symbols-outlined text-[#52695e] text-[20px]">recommend</span>
                </div>
                <h4 className="font-serif font-semibold text-sm text-[#2d2522] mb-1.5">
                  Impact &amp; Alternative
                </h4>
                <p className="text-xs text-[#5a4a46] leading-relaxed">
                  Recommends brother Rafid: 98% match score, open calendar slot, vehicle already equipped.
                </p>
              </div>
              <div className="mt-3 text-[11px] text-[#52695e] font-medium">Zero schedule conflicts</div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl bg-[#fff1ec] border border-[#fcebe5] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#b86b69]">STEP 4</span>
                  <span className="material-symbols-outlined text-[#b86b69] text-[20px]">touch_app</span>
                </div>
                <h4 className="font-serif font-semibold text-sm text-[#2d2522] mb-1.5">
                  1-Tap Approval
                </h4>
                <p className="text-xs text-[#5a4a46] leading-relaxed">
                  Care coordinator approves with one tap. Navigation route sent straight to Rafid's phone.
                </p>
              </div>
              <div className="mt-3 text-[11px] text-[#b86b69] font-medium">Instant reassignment</div>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded-2xl bg-[#d7e8de]/70 border border-[#8fa89b] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#52695e]">STEP 5</span>
                  <span className="material-symbols-outlined text-[#52695e] text-[20px]">verified</span>
                </div>
                <h4 className="font-serif font-semibold text-sm text-[#2d2522] mb-1.5">
                  Circle Notified
                </h4>
                <p className="text-xs text-[#5a4a46] leading-relaxed">
                  No frantic 2 AM text threads, zero guilt or resentment. Grandpa Robert gets to Dr. Chen safely.
                </p>
              </div>
              <div className="mt-3 text-[11px] text-[#52695e] font-bold">Harmony restored</div>
            </div>
          </div>

          {/* Bottom interactive confirmation simulator */}
          <div className="mt-8 p-4 rounded-2xl bg-[#fcebe5]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#52695e] text-[24px]">balance</span>
              <p className="text-xs sm:text-sm text-[#2d2522]">
                <strong>Fair-Balance Guarantee:</strong> Tasks automatically rotate so no single child shoulders consecutive medical days.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestResolution}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#fcebe5] border border-[#ddcbca]/70 text-[#2d2522] font-semibold text-xs shadow-xs transition-all whitespace-nowrap cursor-pointer active:scale-95"
            >
              {simulationActive ? 'Simulating...' : 'Test Resolution Engine'}
            </button>
          </div>

          {/* Interactive Simulation Notification */}
          {simulationActive && (
            <div className="mt-4 p-4 rounded-2xl bg-[#d7e8de] border border-[#8fa89b] text-[#0f281e] text-xs sm:text-sm flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#52695e]">
                  check_circle
                </span>
                <span>
                  <strong>Simulation Active:</strong> Rafid confirmed the 2:00 PM cardiology pickup. Schedule rebalanced in 1.2s without conflict.
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#52695e]">
                Live Rescheduled
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
