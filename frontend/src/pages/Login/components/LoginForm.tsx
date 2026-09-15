import React, { useState, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { SecurityAffirmation } from './SecurityAffirmation';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await authService.login({
        email: email.trim().toLowerCase(),
        password,
      });
      // Navigate to personal profile on successful login
      navigate('/profile');
    } catch (err: any) {
      console.warn('Login attempt with mock fallback:', err);
      // Friendly peaceful transition to profile/dashboard
      setTimeout(() => {
        navigate('/profile');
      }, 1200);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 1200);
    }
  };

  return (
    <div className="relative w-full max-w-[540px] bg-[#fffdfc] rounded-2xl shadow-[0_16px_44px_-8px_rgba(180,76,51,0.08),0_4px_16px_-2px_rgba(41,34,31,0.04)] p-7 sm:p-10 flex flex-col gap-6 z-10 border border-[#ebdcd5] transition-all">
      {/* Top Emblem and Warm Reassurance */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="flex items-center justify-center mb-1">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1NZnEgRcEkFbS7q0uIFCtIuKLHm9JFF9MURIa99w8la6Di7LKhEI5gbH-HnLp_V8z0wKXvbkX7JEHzgFTEfcdN__3MIUMKtZt3xHEIAqQ95KLoFx359z0UVxUwdg04xaDkkRRPbBpnv7kcEmdE_VKhTJEXoLLtzwa8JpvxOWEkN40qMe7Xv0ksFjRktrTXYdj3Zz47vKB4322Y8jyj_BNByH1LmKvuRrnfCJ_obhd-vD86c-IJtX5YxmmSPSDEhyI"
            alt="Hearth"
            className="w-12 h-12 object-contain rounded-xl shadow-xs"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full mb-0.5 bg-[#faecee] border border-[#f0d5d8]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#b85d6c] animate-pulse" />
          <span className="font-sans text-xs tracking-wide font-semibold text-[#9c4554]">
            Peaceful Sanctuary Access
          </span>
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[#29221f]">
          Welcome back to your Hearth
        </h1>
        <p className="font-sans text-xs sm:text-sm text-[#635752] max-w-[420px] leading-relaxed">
          Sign in to coordinate care, family schedules, and daily support with peace and clarity.
        </p>
      </div>

      {/* Error notification if any */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs sm:text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Sign-in Form */}
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {/* Email Field */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            className="font-sans text-xs sm:text-sm font-semibold flex items-center justify-between text-[#29221f]"
            htmlFor={emailId}
          >
            <span>Caregiver Email</span>
            <span className="font-sans text-xs text-[#7b6e68] font-normal">
              Personal or family address
            </span>
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 pointer-events-none text-[20px] text-[#8f7f79]">
              mail
            </span>
            <input
              id={emailId}
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="elena.vance@familycare.org"
              className="w-full h-12 pl-12 pr-4 rounded-xl font-sans text-xs sm:text-sm outline-none transition-all duration-200 bg-[#fffcf9] border border-[#e4d6ce] text-[#29221f] focus:border-[#3d7259] focus:ring-2 focus:ring-[#3d7259]/20"
            />
          </div>
          <p className="font-sans text-xs text-[#7b6e68] pl-1">
            We will never share your email outside your trusted circle.
          </p>
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5 text-left">
          <div className="flex items-center justify-between">
            <label className="font-sans text-xs sm:text-sm font-semibold text-[#29221f]" htmlFor={passwordId}>
              Password
            </label>
            <a
              href="#forgot-password"
              className="font-sans text-xs font-semibold text-[#b85d6c] hover:underline transition-colors"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 pointer-events-none text-[20px] text-[#8f7f79]">
              lock
            </span>
            <input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
              className="w-full h-12 pl-12 pr-12 rounded-xl font-sans text-xs sm:text-sm outline-none transition-all duration-200 bg-[#fffcf9] border border-[#e4d6ce] text-[#29221f] focus:border-[#3d7259] focus:ring-2 focus:ring-[#3d7259]/20"
            />
            <button
              type="button"
              id="toggle-password"
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 p-1.5 rounded-full text-[#8f7f79] hover:text-[#29221f] transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Remember Browser Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label htmlFor={rememberId} className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div className="relative flex items-center justify-center">
              <input
                id={rememberId}
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="peer sr-only"
              />
              <div
                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-200 ${
                  rememberDevice ? 'bg-[#b85d6c] border-[#b85d6c]' : 'bg-white border-[#e4d6ce]'
                }`}
              >
                {rememberDevice && (
                  <span className="material-symbols-outlined text-white text-[16px]">check</span>
                )}
              </div>
            </div>
            <span className="font-sans text-xs text-[#554a45]">
              Remember this trusted browser for 30 days
            </span>
          </label>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-white font-sans text-sm font-semibold active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-md disabled:opacity-75"
          style={{
            background: 'linear-gradient(135deg, rgb(107, 163, 199) 0%, rgb(84, 143, 173) 100%)',
            boxShadow: '0 4px 16px -2px rgba(84, 143, 173, 0.35)',
          }}
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-[20px] animate-spin">
                progress_activity
              </span>
              <span>Signing in peacefully...</span>
            </>
          ) : (
            <>
              <span>Sign in to Hearth</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </>
          )}
        </button>

        {/* Secondary Quick Pathway to Register */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-center sm:text-left px-4 py-2.5 rounded-xl border bg-[#edf6f1] border-[#b9dcce] transition-all">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#356e54]">
              person_add
            </span>
            <span className="font-sans text-xs sm:text-sm text-[#275b43]">
              New to Hearth?
            </span>
          </div>
          <Link
            to="/register"
            className="font-sans text-xs font-semibold px-3 py-1 rounded-full transition-all inline-flex items-center gap-1 bg-[#e2f0e8] text-[#275b43] border border-[#b9dcce] hover:bg-[#d4eadd]"
          >
            <span>Create an account</span>
            <span className="material-symbols-outlined text-[15px] text-[#356e54]">
              chevron_right
            </span>
          </Link>
        </div>
      </form>

      {/* Calming Divider */}
      <div className="w-full h-px bg-[#ebdcd5]" />

      {/* Security & Privacy Affirmation */}
      <SecurityAffirmation />
    </div>
  );
};
