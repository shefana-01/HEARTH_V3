import React from 'react';
import { Link } from 'react-router-dom';

export const LandingNavbar: React.FC = () => {
  return (
    <header className="relative z-30 w-full max-w-7xl mx-auto px-6 sm:px-8 pt-7 pb-4 flex items-center justify-between">
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="grid grid-cols-2 gap-1 w-6 h-6 p-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E88B69]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#D48F6C]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#647987]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#7595A8]" />
        </div>
        <span className="font-bold text-[22px] tracking-tight text-[#1A2027]">ChronoTask</span>
      </Link>

      {/* Navigation Center Links */}
      <nav className="hidden md:flex items-center space-x-10 text-[15px] font-medium text-[#2C343E]">
        <a href="#features" className="hover:text-black transition-colors duration-150">Features</a>
        <a href="#solutions" className="hover:text-black transition-colors duration-150">Solutions</a>
        <a href="#resources" className="hover:text-black transition-colors duration-150">Resources</a>
        <a href="#pricing" className="hover:text-black transition-colors duration-150">Pricing</a>
      </nav>

      {/* Auth Action Links */}
      <div className="flex items-center gap-5">
        <Link
          to="/login"
          className="text-[15px] font-medium text-[#1E252D] hover:text-black transition-colors duration-150"
        >
          Log in
        </Link>
        <Link
          to="/register"
          className="px-5 py-2 text-[14px] font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-full shadow-sm hover:shadow transition-all duration-200"
        >
          Sign up
        </Link>
      </div>
    </header>
  );
};
