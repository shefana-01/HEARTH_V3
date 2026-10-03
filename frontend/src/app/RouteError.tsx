import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { LogoMark } from '@/components/layout/Logo';
import { buttonStyles } from '@/components/ui';

/** Last-resort error screen for unexpected render or loader errors. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unknown error';
  if (import.meta.env.DEV) console.error(error);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <LogoMark className="mb-6 h-12 w-12" />
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-2 max-w-md text-ink-muted">Hearth hit an unexpected problem while showing this page. Nothing you saved has been changed.</p>
      {import.meta.env.DEV && <pre className="mt-4 max-w-xl overflow-auto rounded-xl bg-surface-sunken p-3 text-left text-xs text-ink-muted">{message}</pre>}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className={buttonStyles({ variant: 'secondary' })}>
          Reload page
        </button>
        <Link to="/today" className={buttonStyles()}>
          Go to My day
        </Link>
      </div>
    </main>
  );
}
