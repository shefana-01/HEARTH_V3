import React from 'react';

interface CaregiverCardProps {
  name?: string;
  role?: string;
  circlesCount?: number;
  syncsCount?: number;
  avatarUrl?: string;
}

export const CaregiverCard: React.FC<CaregiverCardProps> = ({
  name = 'Eleanor Miller',
  role = 'Primary Caregiver',
  circlesCount = 3,
  syncsCount = 12,
  avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDj42QITBh6w1FWtSTEgvmZM2b9vTDv3Exw08VfvzbQrfOhV9lGVoPmScnyAjZT3Ep2MyfyP3e7bvsspuwv_XGQFhbANmV6BMegzAYuhZcU504hNKEgOhJXOEiUbOSRedrEKW4RMaN5ndyu_KaesvSvQb7mIUNfYh5nygYjK-pPRS1v3FrrhT-EJI_JCfzm-DonyIj7Ul0VWa8_EV163J4NOLJlvwCfd3gq1mPY_80j7iywOSocCV0',
}) => {
  return (
    <div className="bg-[#fdf2e8] rounded-2xl p-6 shadow-xs flex flex-col items-center text-center relative border border-[#ece1d7]/60">
      {/* Profile Picture with Change Badge */}
      <div className="relative w-32 h-32 mb-4">
        <img
          alt={name}
          className="w-full h-full rounded-full object-cover shadow-md border-2 border-white"
          src={avatarUrl}
        />
        <button
          type="button"
          aria-label="Change profile photo"
          className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#983d1d] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">photo_camera</span>
        </button>
      </div>

      {/* Name & Role */}
      <h2 className="font-serif text-xl sm:text-2xl text-[#201b15] font-semibold">{name}</h2>
      <p className="font-sans text-xs sm:text-sm text-[#56423c] mt-1">{role}</p>

      {/* Stats Divider & Row */}
      <div className="w-full mt-6 pt-5 border-t border-[#ece1d7] flex justify-around text-center">
        <div>
          <span className="font-serif text-xl sm:text-2xl text-[#983d1d] font-bold block">
            {circlesCount}
          </span>
          <span className="font-sans text-xs text-[#56423c]">Circles</span>
        </div>
        <div className="w-px bg-[#ece1d7]" />
        <div>
          <span className="font-serif text-xl sm:text-2xl text-[#3b5d77] font-bold block">
            {syncsCount}
          </span>
          <span className="font-sans text-xs text-[#56423c]">Syncs</span>
        </div>
      </div>
    </div>
  );
};
