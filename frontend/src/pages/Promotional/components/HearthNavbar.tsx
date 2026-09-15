import React from 'react';
import { Link } from 'react-router-dom';

export const HearthNavbar: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#fff8f6]/90 backdrop-blur-md border-b border-[#f5dfd7]/80 transition-all">
      <div className="h-20 max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#b86b69] via-[#c47c7a] to-[#d4a373] flex items-center justify-center text-white shadow-sm shadow-[#b86b69]/25 transition-transform group-hover:scale-105">
            <span className="material-symbols-outlined text-[24px]">local_fire_department</span>
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-semibold text-xl text-[#2d2522] tracking-tight leading-none">
              Hearth
            </span>
            <span className="text-xs text-[#5a4a46] font-medium tracking-wide">
              Family Care Coordination
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 py-1 px-2 rounded-full bg-[#fcebe5]/60 border border-[#ecd7ce]/60 text-sm font-medium text-[#5a4a46]">
          <a
            className="px-4 py-2 rounded-full hover:text-[#2d2522] hover:bg-white/80 transition-colors"
            href="#the-problem"
          >
            The Problem
          </a>
          <a
            className="px-4 py-2 rounded-full hover:text-[#2d2522] hover:bg-white/80 transition-colors"
            href="#caregraph"
          >
            CareGraph™
          </a>
          <a
            className="px-4 py-2 rounded-full hover:text-[#2d2522] hover:bg-white/80 transition-colors"
            href="#intelligent-loop"
          >
            Intelligent Loop
          </a>
          <a
            className="px-4 py-2 rounded-full hover:text-[#2d2522] hover:bg-white/80 transition-colors"
            href="#for-families"
          >
            For Families
          </a>
          <a
            className="px-4 py-2 rounded-full hover:text-[#2d2522] hover:bg-white/80 transition-colors"
            href="#privacy-trust"
          >
            Privacy &amp; Trust
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2.5 text-sm font-semibold text-[#5a4a46] hover:text-[#2d2522] transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#b86b69] hover:bg-[#a35b5a] text-white font-semibold text-sm shadow-xs hover:shadow transition-all active:scale-[0.98]"
          >
            <span>Get Started</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
