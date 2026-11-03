import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { applyUpdate, UPDATE_READY_EVENT } from '@/services/pwa/serviceWorker';

/** "A new version of Hearth is ready" — shown once the service worker has downloaded an update. */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const show = () => setReady(true);
    window.addEventListener(UPDATE_READY_EVENT, show);
    return () => window.removeEventListener(UPDATE_READY_EVENT, show);
  }, []);
  if (!ready) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-overlay lg:bottom-6"
    >
      <RefreshCw aria-hidden="true" className="h-5 w-5 shrink-0 text-primary-600" />
      <p className="min-w-0 flex-1 text-sm text-ink">A new version of Hearth is ready.</p>
      <Button size="sm" variant="secondary" onClick={() => setReady(false)}>
        Later
      </Button>
      <Button size="sm" onClick={applyUpdate}>
        Reload
      </Button>
    </div>
  );
}
