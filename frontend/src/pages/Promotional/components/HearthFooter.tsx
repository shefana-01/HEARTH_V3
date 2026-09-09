import React from 'react';

export const HearthFooter: React.FC = () => {
  return (
    <footer className="w-full bg-[#fff1ec] border-t border-[#fcebe5] py-14">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Summary */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#b86b69] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">
                  local_fire_department
                </span>
              </div>
              <span className="font-serif font-semibold text-xl text-[#2d2522]">Hearth</span>
            </div>
            <p className="text-xs sm:text-sm text-[#5a4a46] leading-relaxed">
              Gentle, tactile care coordination built for aging parents, busy adult caregivers, and family circles.
            </p>
          </div>

          {/* Care Pillars */}
          <div className="space-y-3">
            <h4 className="font-serif font-semibold text-sm text-[#2d2522]">Care Pillars</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#5a4a46]">
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#caregraph">
                  Daily CareGraph™ Flow
                </a>
              </li>
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#the-problem">
                  Silo Defragmentation
                </a>
              </li>
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#intelligent-loop">
                  Intelligent Resolution Loop
                </a>
              </li>
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#for-families">
                  Multi-Generational Experience
                </a>
              </li>
            </ul>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h4 className="font-serif font-semibold text-sm text-[#2d2522]">Platform</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#5a4a46]">
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#the-problem">
                  The Problem
                </a>
              </li>
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#caregraph">
                  How It Works
                </a>
              </li>
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#for-families">
                  Personas &amp; Views
                </a>
              </li>
              <li>
                <a className="hover:text-[#2d2522] transition-colors" href="#privacy-trust">
                  Privacy &amp; Trust
                </a>
              </li>
            </ul>
          </div>

          {/* Trust & Security */}
          <div className="space-y-3">
            <h4 className="font-serif font-semibold text-sm text-[#2d2522]">Trust &amp; Compliance</h4>
            <div className="flex flex-col gap-2.5 text-xs sm:text-sm text-[#5a4a46]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#52695e] text-[18px]">
                  verified_user
                </span>
                <span>HIPAA-Verified Security</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#52695e] text-[18px]">
                  accessibility_new
                </span>
                <span>WCAG AAA Accessible</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#52695e] text-[18px]">lock</span>
                <span>256-Bit End-to-End Encrypted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#fcebe5] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#5a4a46]">
          <p>© 2025 Hearth Family Care Coordination. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a className="hover:text-[#2d2522] transition-colors" href="#privacy">
              Privacy Policy
            </a>
            <a className="hover:text-[#2d2522] transition-colors" href="#terms">
              Terms of Care
            </a>
            <a className="hover:text-[#2d2522] transition-colors" href="#accessibility">
              Accessibility Pledge
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
