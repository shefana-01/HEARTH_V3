import React from 'react';
import { Link } from 'react-router-dom';

export const HeroCenter: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center w-full max-w-[620px] aspect-square">
      {/* Large Warm Cream Radial Circle */}
      <div className="absolute inset-0 rounded-full bg-[#F3E7D7] opacity-90 shadow-[0_20px_50px_rgba(180,165,145,0.15)] pointer-events-none scale-105 md:scale-100" />

      {/* Center Floating Logo Badge */}
      <div className="absolute top-10 md:top-14 z-20 bg-white rounded-3xl p-4 icon-shadow border border-white/80">
        <div className="grid grid-cols-2 gap-2.5 w-10 h-10">
          <span className="w-4 h-4 rounded-full bg-[#E58163]" />
          <span className="w-4 h-4 rounded-full bg-[#CB7A57]" />
          <span className="w-4 h-4 rounded-full bg-[#6C787A]" />
          <span className="w-4 h-4 rounded-full bg-[#62849F]" />
        </div>
      </div>

      {/* Center Typography and Call to Action */}
      <div className="relative z-20 text-center px-6 max-w-lg mt-14">
        <h1 className="text-4xl sm:text-5xl md:text-[56px] font-extrabold tracking-tight text-[#0F141A] leading-[1.12]">
          Think, plan, and track <br />
          <span className="block mt-1">all in one place</span>
        </h1>
        <p className="mt-6 text-[16px] md:text-[17px] text-[#3D4752] font-normal tracking-normal max-w-md mx-auto leading-relaxed">
          Efficiently manage your tasks and boost productivity.
        </p>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[15px] font-medium shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 duration-150"
            >
              Sign up
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white/70 hover:bg-white text-[#1E242B] text-[15px] font-medium border border-white/90 shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0 duration-150"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
