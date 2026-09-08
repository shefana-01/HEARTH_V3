import React from 'react';
import { Link } from 'react-router-dom';

export const SignInPrompt: React.FC = () => {
  return (
    <div className="w-full bg-[#cee9da]/70 rounded-xl p-4 flex items-center justify-center text-center shadow-xs border border-[#b3ccbf]/50">
      <span className="font-sans text-sm sm:text-base text-[#354c41]">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-sans text-sm sm:text-base text-[#4c6358] font-semibold hover:underline ml-1"
        >
          Sign in
        </Link>
      </span>
    </div>
  );
};
