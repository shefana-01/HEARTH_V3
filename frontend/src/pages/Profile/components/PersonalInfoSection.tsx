import React from 'react';

interface PersonalInfoSectionProps {
  fullName?: string;
  phone?: string;
  email?: string;
}

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({
  fullName = 'Eleanor Vance Miller',
  phone = '+1 (555) 382-9012',
  email = 'eleanor.miller@hearth.care',
}) => {
  return (
    <div className="bg-[#fdf2e8] rounded-2xl shadow-xs overflow-hidden border border-[#ece1d7]/60">
      <div className="px-6 py-4 bg-[#f1e6dc]/40 border-b border-[#ece1d7]/40">
        <h3 className="font-sans text-base sm:text-lg font-bold text-[#201b15]">
          Personal Information
        </h3>
      </div>

      <div className="divide-y divide-[#ece1d7]/40">
        {/* Full Name Row */}
        <div className="p-5 flex items-center justify-between hover:bg-[#f7ece2]/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#ffdbd0] flex items-center justify-center text-[#983d1d] shrink-0">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div>
              <span className="font-sans text-xs font-semibold text-[#201b15] block">
                Full Name
              </span>
              <span className="font-sans text-sm text-[#56423c]">{fullName}</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#56423c] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>

        {/* Phone Number Row */}
        <div className="p-5 flex items-center justify-between hover:bg-[#f7ece2]/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#c5ecd1] flex items-center justify-center text-[#436651] shrink-0">
              <span className="material-symbols-outlined text-[20px]">phone</span>
            </div>
            <div>
              <span className="font-sans text-xs font-semibold text-[#201b15] block">
                Phone Number
              </span>
              <span className="font-sans text-sm text-[#56423c]">{phone}</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#56423c] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>

        {/* Email Address Row */}
        <div className="p-5 flex items-center justify-between hover:bg-[#f7ece2]/60 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#cae6ff] flex items-center justify-center text-[#3b5d77] shrink-0">
              <span className="material-symbols-outlined text-[20px]">mail</span>
            </div>
            <div>
              <span className="font-sans text-xs font-semibold text-[#201b15] block">
                Email Address
              </span>
              <span className="font-sans text-sm text-[#56423c]">{email}</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#56423c] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>
      </div>
    </div>
  );
};
