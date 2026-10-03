import { Button } from '@/components/ui';

/** Small inline error for one block of a page, so a failed request does not blank everything else. */
export function BlockError({ message = 'We couldn’t load this.', onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
      <span>{message}</span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
