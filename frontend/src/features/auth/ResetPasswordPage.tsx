import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/auth/authService';
import { useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { passwordError } from '@/lib/validation';
import { Button, ButtonLink, Callout, Card, FormError, FormField, PasswordInput, useToast } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

/** Opened from the link in the "Reset your password" message. */
export default function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const reset = useMutation(authService.confirmPasswordReset);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      password: passwordError(form.password),
      confirm: !form.confirm ? 'Please confirm your password.' : form.confirm !== form.password ? 'The passwords don’t match.' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    if (await reset.attempt(token, form.password)) {
      toast({ title: 'Password changed', description: 'Sign in with your new password.' });
      navigate('/sign-in', { replace: true });
    }
  };

  return (
    <AuthLayout>
      <Card padding="lg" className="shadow-raised">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl sm:text-3xl">Choose a new password</h1>
          <p className="mt-2 text-ink-muted">You’ll be signed out everywhere else.</p>
        </div>
        {!token ? (
          <>
            <Callout tone="amber">This link is not complete. Open the link from the email again, or ask for a new one from the sign-in page.</Callout>
            <ButtonLink to="/sign-in" variant="secondary" className="mt-4">
              Back to sign in
            </ButtonLink>
          </>
        ) : (
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <FormError message={reset.error} />
            <FormField label="New password" error={errors.password} hint="At least 8 characters, with an uppercase letter and a number or symbol." required>
              {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
            </FormField>
            <FormField label="Confirm new password" error={errors.confirm} required>
              {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />}
            </FormField>
            <Button type="submit" block loading={reset.pending}>
              Save new password
            </Button>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
