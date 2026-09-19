import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheckBig, MailX } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { authService } from '@/services/auth/authService';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ButtonLink, Card, Skeleton } from '@/components/ui';
import { AuthLayout } from './AuthLayout';
import { EmailConfirmNotice } from '@/components/domain/EmailConfirmNotice';

/**
 * A link works once. React runs effects twice in development, so remember the
 * request per token and reuse it instead of sending the token a second time.
 */
const attempts = new Map<string, Promise<void>>();
const confirmOnce = (token: string) => {
  let attempt = attempts.get(token);
  if (!attempt) {
    attempt = authService.verifyEmail(token);
    attempts.set(token, attempt);
  }
  return attempt;
};

/** Opened from the link in the "Confirm your email" message. */
export default function VerifyEmailPage() {
  useDocumentTitle('Confirm your email');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { session, refreshSession } = useAuth();

  const result = useAsync(async () => {
    if (!token) throw new Error('This link is not complete. Open the link from the email again.');
    await confirmOnce(token);
    await refreshSession();
    return true;
  }, [token]);

  return (
    <AuthLayout>
      <Card padding="lg" className="text-center shadow-raised">
        {result.status === 'error' ? (
          <>
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <MailX aria-hidden="true" className="h-7 w-7" />
            </span>
            <h1 className="font-display text-2xl">We couldn’t confirm your email</h1>
            <p role="alert" className="mt-2 text-ink-muted">
              {result.error?.message}
            </p>
            <p className="mt-2 text-sm text-ink-muted">If you already confirmed it, you don’t need to do anything else.</p>
            <div className="mt-5 text-left">
              <EmailConfirmNotice />
            </div>
            <ButtonLink to={session ? '/dashboard' : '/sign-in'} variant="secondary" className="mt-5">
              {session ? 'Back to Hearth' : 'Sign in'}
            </ButtonLink>
          </>
        ) : !result.data ? (
          <div role="status" aria-label="Confirming your email">
            <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
            <Skeleton className="mx-auto mt-4 h-7 w-56" />
            <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
            <h1 className="sr-only">Confirming your email…</h1>
          </div>
        ) : (
          <>
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-100 text-mint-700">
              <CircleCheckBig aria-hidden="true" className="h-7 w-7" />
            </span>
            <h1 className="font-display text-2xl">Your email is confirmed</h1>
            <p className="mt-2 text-ink-muted">Thank you. You can now join a family you were invited to.</p>
            <ButtonLink to={session ? '/dashboard' : '/sign-in'} className="mt-5">
              {session ? 'Continue to Hearth' : 'Sign in'}
            </ButtonLink>
            {session && (
              <p className="mt-4 text-sm text-ink-muted">
                Have a family code?{' '}
                <Link to="/join" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
                  Join a family
                </Link>
              </p>
            )}
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
