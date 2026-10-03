import { Compass } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { ButtonLink, EmptyState } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { session } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Logo className="mb-10 self-center" />
      <EmptyState
        icon={<Compass aria-hidden="true" />}
        headingLevel="h1"
        title="We couldn’t find that page"
        description="The link may be out of date, or the page may have moved."
        action={<ButtonLink to={session ? '/today' : '/'}>{session ? 'Back to My day' : 'Back to home'}</ButtonLink>}
      />
    </div>
  );
}
