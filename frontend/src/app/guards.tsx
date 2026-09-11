import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useFamily } from './FamilyProvider';
import { ErrorState, Spinner } from '@/components/ui';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-primary-600">
      <Spinner size="lg" label="Loading Hearth" />
    </div>
  );
}

function FamilyLoadError() {
  const { refresh } = useFamily();
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <ErrorState title="We couldn’t load your family" message="Check your connection and try again." onRetry={() => void refresh()} />
    </div>
  );
}

/** Signed-in area. Unauthenticated visitors go to sign-in and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (!session) return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

/** Pages that need a family circle; new accounts are sent to onboarding first. */
export function RequireFamily({ children }: { children: ReactNode }) {
  const { status, family } = useFamily();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'error') return <FamilyLoadError />;
  if (!family) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Sign-in / sign-up: already signed-in users skip straight to the app. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (session) return <Navigate to={session.hasFamily ? '/dashboard' : '/onboarding'} replace />;
  return <>{children}</>;
}
