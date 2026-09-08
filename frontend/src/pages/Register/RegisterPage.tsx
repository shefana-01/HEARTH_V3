import React from 'react';
import { RegisterHeader } from './components/RegisterHeader';
import { RegisterForm } from './components/RegisterForm';
import { SignInPrompt } from './components/SignInPrompt';
import { TrustBadges } from './components/TrustBadges';

export const RegisterPage: React.FC = () => {
  return (
    <main className="w-full min-h-screen bg-[#fff8f6] flex flex-col justify-center items-center relative overflow-hidden selection:bg-[#cee9da] selection:text-[#092017]">
      {/* Ambient background glowing orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#cee9da] opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-[#ffdad8] opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 w-96 h-96 rounded-full bg-[#ffdcbd] opacity-25 blur-3xl pointer-events-none" />

      {/* Main Sanctuary Card Container */}
      <div className="flex flex-col w-full items-center justify-center py-10 px-4 sm:px-6 relative z-10">
        <div className="w-full max-w-xl mx-auto flex flex-col items-center">
          <RegisterHeader />
          <RegisterForm />
          <SignInPrompt />
          <TrustBadges />
        </div>
      </div>
    </main>
  );
};
