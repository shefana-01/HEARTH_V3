/**
 * Small, dependency-free validators. Each returns an error message or `undefined`.
 */

export type Validator = (value: string) => string | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export const required =
  (label: string): Validator =>
  (value) =>
    value.trim() ? undefined : `${label} is required.`;

export const email: Validator = (value) => (!value.trim() || EMAIL_RE.test(value.trim()) ? undefined : 'Enter a valid email address, like name@example.com.');

export const phone: Validator = (value) => (!value.trim() || PHONE_RE.test(value.trim()) ? undefined : 'Enter a valid phone number.');

export const minLength =
  (label: string, min: number): Validator =>
  (value) =>
    !value || value.trim().length >= min ? undefined : `${label} must be at least ${min} characters.`;

export const maxLength =
  (label: string, max: number): Validator =>
  (value) =>
    value.length <= max ? undefined : `${label} must be ${max} characters or fewer.`;

/** Run validators in order and return the first error. */
export function validate(value: string, ...validators: Validator[]): string | undefined {
  for (const v of validators) {
    const error = v(value);
    if (error) return error;
  }
  return undefined;
}

export interface PasswordRule {
  id: 'length' | 'number' | 'upper';
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: '8+ characters', test: (v) => v.length >= 8 },
  { id: 'number', label: '1 number or symbol', test: (v) => /[0-9\W_]/.test(v) },
  { id: 'upper', label: '1 uppercase letter', test: (v) => /[A-Z]/.test(v) },
];

export function passwordError(value: string): string | undefined {
  if (!value) return 'Create a password.';
  const failed = PASSWORD_RULES.filter((r) => !r.test(value));
  return failed.length ? `Password needs ${failed.map((r) => r.label).join(', ')}.` : undefined;
}

/** True when an errors object has at least one message. */
export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
