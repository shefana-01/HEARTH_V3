import React from 'react';
import { Link } from 'react-router-dom';

export const RegisterHeader: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      {/* Brand logo & title */}
      <Link to="/" className="flex items-center gap-3 mb-3 group focus:outline-none">
        <img
          alt="Hearth Logo"
          className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6Dtkz5FZYHh2IvSCWZGHxXagnwdq1qsH4uhRzzYHPLutRva62TkX7VTsmiKlwsSlqQB-bZHgsUmT5GCwi-ce0fn_zc-muE_dhrAWEpPYGBB0HAf9j6GUUKhIpzD1WsQ4INKWA9iRuf28nyr5XL_f0n_be4g9BVQlVeXSer4LS52Bu10_ZvoEunw9MIiQYZVI84CBz2OB5KYQiv-Sj9ul-s1zNTVL9hDL9GZxHTbz8wHn_3vhm8GEKpqsHiH0-03Ex"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <span className="font-serif text-3xl sm:text-4xl text-[#211a17] tracking-tight font-semibold">
          Hearth
        </span>
      </Link>

      {/* Gentle Tagline Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#cee9da] text-[#52695e] font-sans text-xs font-semibold tracking-wide mb-3 shadow-xs">
        <span className="material-symbols-outlined text-[16px] text-[#4c6358]">favorite</span>
        <span>A warm, safe place for family care</span>
      </div>

      {/* Primary Headline */}
      <h1 className="font-serif text-2xl sm:text-3xl text-[#211a17] font-medium tracking-tight">
        Create your care sanctuary
      </h1>

      {/* Reassuring Subtitle */}
      <p className="font-sans text-sm sm:text-base text-[#534342] mt-2 max-w-md leading-relaxed">
        Designed for dignity, tenderness, and peace of mind across generations.
      </p>
    </div>
  );
};
