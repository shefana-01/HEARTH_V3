import React from 'react';
import { Link } from 'react-router-dom';

export const LoginTopBar: React.FC = () => {
  return (
    <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between px-6 sm:px-12 pt-8 z-20">
      {/* Brand logo & name */}
      <Link to="/" className="flex items-center gap-2.5 group focus:outline-none">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-xs overflow-hidden bg-white border border-[#ebdcd5] transition-transform group-hover:scale-105">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJONYw_1TndHpMoiHWG9LwXWT4nOtA1twwR2d2KrD9kbI-UXWQf9gfRAqo6shFsb-m9cIHZyBuVHHTZbhCGUU3piZTnyce7N8fWRAnmbqR9W0aJ6rLeFOSrPi83nzAUl2iVwC5DHNAGfoyO2XyDn6Uf3haX-lWcakwTq6RsIkrikzz7I7S-mhhMcNkSZRpquPBxeDyXzbmh_9NB9iOElb5MFELJKk2HiDwae0afcN-D45nTL86-XwQ-WqlfsIZQLsv"
            alt="Hearth Logo"
            className="w-8 h-8 object-contain rounded-full"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[#29221f]">
            Hearth
          </span>
          <span
            className="material-symbols-outlined text-[16px] text-[#387455]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            eco
          </span>
        </div>
      </Link>

      {/* Sanctuary Badge */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#edf6f1]/85 border border-[#d4e7dc] shadow-2xs">
        <span className="material-symbols-outlined text-[17px] text-[#285740]">
          nature_people
        </span>
        <span className="font-sans text-xs font-semibold text-[#285740]">
          Caregiver Sanctuary
        </span>
      </div>
    </div>
  );
};
