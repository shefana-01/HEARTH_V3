import React from 'react';
import { LoginTopBar } from './components/LoginTopBar';
import { LoginForm } from './components/LoginForm';
import { LoginFooter } from './components/LoginFooter';

export const LoginPage: React.FC = () => {
  return (
    <div
      className="min-h-screen font-sans text-[#211a17] antialiased flex flex-col justify-between selection:bg-[#b3ccbf] selection:text-[#092017] relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 18% 18%, rgba(237, 245, 241, 0.95) 0%, rgba(252, 248, 243, 0.9) 45%, rgba(251, 240, 235, 0.85) 100%)',
      }}
    >
      {/* Top Application Bar */}
      <LoginTopBar />

      {/* Main Authentication Sanctuary Container */}
      <main className="w-full max-w-[1440px] mx-auto flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="flex flex-col w-full relative items-center justify-center py-2">
          {/* Soft Ambient Glow Orbs */}
          <div
            className="absolute -top-24 -left-20 w-96 h-96 rounded-full opacity-40 blur-3xl pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(184, 84, 51, 0.18) 0%, rgba(240, 189, 139, 0.12) 60%, transparent 80%)',
            }}
          />
          <div
            className="absolute -bottom-24 -right-20 w-[420px] h-[420px] rounded-full opacity-60 blur-3xl pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(56, 116, 85, 0.18) 0%, rgba(206, 233, 218, 0.25) 50%, transparent 75%)',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-50 blur-[100px] pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(250, 237, 232, 0.8) 0%, rgba(252, 248, 243, 0.4) 60%, transparent 85%)',
            }}
          />

          {/* Core Sign-in Sanctuary Card */}
          <LoginForm />
        </div>
      </main>

      {/* Peaceful Caregiver Footer */}
      <LoginFooter />
    </div>
  );
};
