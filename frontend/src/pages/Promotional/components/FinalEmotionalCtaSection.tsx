import React from 'react';
import { Link } from 'react-router-dom';

export const FinalEmotionalCtaSection: React.FC = () => {
  return (
    <section className="w-full py-20 lg:py-24 max-w-7xl mx-auto px-5 sm:px-8" id="get-started">
      <div className="relative bg-gradient-to-br from-white via-[#fff1ec] to-[#fcebe5] p-8 sm:p-12 lg:p-16 rounded-3xl shadow-xl border border-[#f5dfd7] overflow-hidden">
        {/* Warm ambient corner glow */}
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#ffdad8]/40 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          {/* Left CTA content */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ffdad8] text-[#b86b69] text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">favorite</span>
              <span>Begin Your Family Circle</span>
            </div>

            <h2 className="font-serif font-semibold text-3xl sm:text-4xl lg:text-[42px] text-[#2d2522] leading-tight">
              Bring peace, predictability, and warmth back to your family hearth.
            </h2>

            <p className="text-base sm:text-lg text-[#5a4a46] font-normal leading-relaxed">
              Start coordinating with your family circle today. Free for up to 8 members. Set up medication schedules and daily care in under 4 minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-2xl bg-[#b86b69] hover:bg-[#a35b5a] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all active:scale-[0.99] gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <span>Get Started Free</span>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center min-h-[54px] px-7 rounded-2xl bg-white hover:bg-[#fcebe5] border border-[#ddcbca]/70 text-[#2d2522] font-semibold text-base shadow-xs hover:shadow transition-all gap-2"
              >
                <span className="material-symbols-outlined text-[20px] text-[#52695e]">login</span>
                <span>Sign In to Your Circle</span>
              </Link>
            </div>
          </div>

          {/* Right: Testimonial snippet card */}
          <div className="lg:col-span-5">
            <div className="bg-white/90 backdrop-blur-md p-6 sm:p-7 rounded-2xl border border-[#fcebe5] space-y-4 shadow-sm">
              <span className="material-symbols-outlined text-[#d4a373] text-[36px] leading-none">
                format_quote
              </span>
              <p className="font-serif italic text-base sm:text-lg text-[#2d2522] leading-relaxed">
                “For the first time in three years caring for my father, my brother and I aren’t guessing or arguing over text messages. We just know. It gave us our family back.”
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="w-11 h-11 rounded-full bg-[#8c6239] text-white flex items-center justify-center font-serif font-semibold text-sm">
                  AM
                </div>
                <div>
                  <h4 className="font-serif font-semibold text-sm text-[#2d2522]">Afsara Mannan</h4>
                  <p className="text-xs text-[#5a4a46]">
                    Primary Family Caregiver · Dhaka, Bangladesh
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
