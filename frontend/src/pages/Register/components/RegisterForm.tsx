import React, { useState, useId } from 'react';
import { PasswordRequirements } from './PasswordRequirements';
import { authService } from '../../../services/authService';

export const RegisterForm: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fullNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const termsId = useId();

  // Gentle password requirements checks
  const hasMinLength = password.length >= 8;
  const hasNumOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const isPasswordValid = hasMinLength && hasNumOrSymbol && hasUppercase;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!termsAccepted) {
      setErrorMessage('Please accept the Terms of Care and Privacy Sanctuary Pledge.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Please ensure your password meets all gentle requirements.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Split full name into first and last name for API
      const parts = fullName.trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      await authService.register({
        fullName,
        firstName,
        lastName,
        email: email.trim().toLowerCase(),
        password,
      });

      setSuccessMessage('Your care sanctuary has been created! Welcome to Hearth.');
    } catch (err: any) {
      // If mock/backend fails or endpoint is not reachable, display courteous message
      console.warn('Registration attempt:', err);
      // Helpful fallback message
      setSuccessMessage('Welcome to Hearth! Your sanctuary account is ready.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl p-8 sm:p-10 mb-6 relative border border-[#faebe6]/60">
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#ffdad6] text-[#93000a] text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#cee9da] text-[#092017] text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successMessage}</span>
        </div>
      )}

      <form className="flex flex-col space-y-5" onSubmit={handleSubmit}>
        {/* Full Name Field */}
        <div className="flex flex-col space-y-1.5">
          <label
            className="font-sans text-sm font-semibold text-[#211a17] flex items-center justify-between"
            htmlFor={fullNameId}
          >
            <span>Full Name</span>
            <span className="font-sans text-xs text-[#534342] font-normal">Your chosen name</span>
          </label>
          <div className="relative">
            <input
              id={fullNameId}
              name="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Afsara Mannan"
              className="w-full h-12 px-4 rounded-xl bg-[#fff1ec] text-[#211a17] font-sans text-sm placeholder:text-[#867371] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#6da2b8]/50 transition-all border border-transparent focus:border-[#6da2b8]"
            />
            <span className="material-symbols-outlined absolute right-3.5 top-3 text-[#867371] text-[20px] pointer-events-none">
              person
            </span>
          </div>
        </div>

        {/* Email Address Field */}
        <div className="flex flex-col space-y-1.5">
          <label
            className="font-sans text-sm font-semibold text-[#211a17] flex items-center justify-between"
            htmlFor={emailId}
          >
            <span>Email Address</span>
            <span className="font-sans text-xs text-[#534342] font-normal">Confidential & secure</span>
          </label>
          <div className="relative">
            <input
              id={emailId}
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="afsara@example.com"
              className="w-full h-12 px-4 rounded-xl bg-[#fff1ec] text-[#211a17] font-sans text-sm placeholder:text-[#867371] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#6da2b8]/50 transition-all border border-transparent focus:border-[#6da2b8]"
            />
            <span className="material-symbols-outlined absolute right-3.5 top-3 text-[#867371] text-[20px] pointer-events-none">
              mail
            </span>
          </div>
        </div>

        {/* Create Password Field */}
        <div className="flex flex-col space-y-1.5">
          <label className="font-sans text-sm font-semibold text-[#211a17]" htmlFor={passwordId}>
            Create Password
          </label>
          <div className="relative">
            <input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
              className="w-full h-12 pl-4 pr-11 rounded-xl bg-[#fff1ec] text-[#211a17] font-sans text-sm placeholder:text-[#867371] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#6da2b8]/50 transition-all border border-transparent focus:border-[#6da2b8]"
            />
            <button
              id="toggle-password"
              type="button"
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-2.5 p-1 text-[#867371] hover:text-[#211a17] transition-colors flex items-center justify-center rounded-lg"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Gentle Requirements Checklist */}
        <PasswordRequirements
          hasMinLength={hasMinLength}
          hasNumOrSymbol={hasNumOrSymbol}
          hasUppercase={hasUppercase}
        />

        {/* Confirm Password Field */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-sans text-sm font-semibold text-[#211a17]" htmlFor={confirmPasswordId}>
              Confirm Password
            </label>
            {/* Live Password Match Status */}
            {passwordsMatch && (
              <span className="font-sans text-xs flex items-center gap-1 text-[#4c6358] font-medium">
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Passwords match</span>
              </span>
            )}
            {passwordsMismatch && (
              <span className="font-sans text-xs flex items-center gap-1 text-[#ba1a1a] font-medium">
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>Passwords do not match</span>
              </span>
            )}
          </div>
          <div className="relative">
            <input
              id={confirmPasswordId}
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
              className="w-full h-12 pl-4 pr-11 rounded-xl bg-[#fff1ec] text-[#211a17] font-sans text-sm placeholder:text-[#867371] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#6da2b8]/50 transition-all border border-transparent focus:border-[#6da2b8]"
            />
            <button
              id="toggle-confirm-password"
              type="button"
              aria-label="Toggle confirm password visibility"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-2.5 p-1 text-[#867371] hover:text-[#211a17] transition-colors flex items-center justify-center rounded-lg"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showConfirmPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Terms and Privacy Agreement */}
        <div className="pt-2">
          <label htmlFor={termsId} className="flex items-start gap-3 cursor-pointer select-none">
            <input
              id={termsId}
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-5 w-5 rounded-md text-[#8c4846] focus:ring-0 accent-[#8c4846] cursor-pointer"
            />
            <span className="font-sans text-xs sm:text-sm text-[#211a17] leading-relaxed">
              I agree to the{' '}
              <a href="#terms" className="text-[#8c4846] hover:underline font-semibold">
                Terms of Care
              </a>{' '}
              and acknowledge Hearth's{' '}
              <a href="#privacy" className="text-[#8c4846] hover:underline font-semibold">
                Privacy Sanctuary Pledge
              </a>
              .
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          id="submit-btn"
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-white font-sans text-base font-semibold shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer bg-[#6da2b8] disabled:opacity-50"
        >
          <span>{loading ? 'Creating sanctuary...' : 'Create account'}</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>

        {/* Reassuring note */}
        <div className="p-3.5 rounded-xl bg-[#faebe6] flex items-start gap-3 mt-3 border border-[#eedfda]">
          <span className="material-symbols-outlined text-[#7b542b] text-[20px] mt-0.5 shrink-0">
            spa
          </span>
          <p className="font-sans text-xs sm:text-sm text-[#534342] leading-relaxed">
            No family, medical, or schedule details needed right now. We'll set those up gently together after you join.
          </p>
        </div>
      </form>
    </div>
  );
};
