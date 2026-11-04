import { useState } from 'react';
import { CalendarCheck2, Copy, Download, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { calendarService, feedUrls } from '@/services/schedule/calendarService';
import { isDemoMode } from '@/services/config';
import { useAsync } from '@/hooks/useAsync';
import { timeAgo } from '@/lib/dates';
import { Badge, Button, Callout, Card, CardHeader, ConfirmDialog, ErrorState, Input, Skeleton, useToast } from '@/components/ui';

/** Calendar sync: a private address for Google Calendar, Apple Calendar or Outlook. */
export function CalendarSection() {
  const { toast } = useToast();
  const status = useAsync(() => calendarService.status(), []);
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const make = async () => {
    setPending(true);
    try {
      const feed = await calendarService.create();
      setToken(feed.token ?? null);
      await status.reload();
      toast({ title: status.data?.active ? 'New address made' : 'Calendar address made', description: status.data?.active ? 'The old address no longer works.' : undefined });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t make the address', description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(false);
    }
  };

  const off = async () => {
    setPending(true);
    try {
      await calendarService.remove();
      setToken(null);
      await status.reload();
      toast({ title: 'Calendar sync is off', description: 'The address no longer works.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t turn it off', description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(false);
      setConfirmOff(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Address copied' });
    } catch {
      toast({ tone: 'error', title: 'Couldn’t copy', description: 'Select the address and copy it yourself.' });
    }
  };

  const urls = token ? feedUrls(token) : null;

  return (
    <Card as="section" aria-labelledby="calendar-heading">
      <CardHeader title={<span id="calendar-heading">Calendar sync</span>} icon={<CalendarCheck2 aria-hidden="true" className="h-5 w-5" />} />
      <div className="space-y-4 text-sm text-ink-muted">
        <p>See your Hearth tasks, your own events and your time away in Google Calendar, Apple Calendar or Outlook. Your calendar app checks for changes every hour or so.</p>
        {isDemoMode ? (
          <>
            <p>In the demo there’s no server for a calendar app to reach, so you can download your plan as a calendar file instead.</p>
            <Button variant="secondary" onClick={() => calendarService.downloadMyPlan()} leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}>
              Download my plan (.ics)
            </Button>
          </>
        ) : status.status === 'error' ? (
          <ErrorState message={status.error?.message} onRetry={status.reload} />
        ) : !status.data ? (
          <Skeleton className="h-16" />
        ) : (
          <>
            {status.data.active && (
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone="mint">On</Badge>
                {status.data.lastFetchedAt ? `Your calendar app last checked ${timeAgo(status.data.lastFetchedAt)}.` : 'No calendar app has used the address yet.'}
              </p>
            )}
            {urls ? (
              <div className="space-y-3">
                <Callout tone="amber" title="Keep this address private">
                  Anyone with it can see your plan. It’s shown only now; if you lose it, make a new one.
                </Callout>
                <div className="flex gap-2">
                  <label htmlFor="calendar-url" className="sr-only">
                    Calendar address
                  </label>
                  <Input id="calendar-url" readOnly value={urls.https} onFocus={(e) => e.target.select()} />
                  <Button variant="secondary" onClick={() => void copy(urls.https)} leftIcon={<Copy aria-hidden="true" className="h-4 w-4" />}>
                    Copy
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={urls.google} target="_blank" rel="noreferrer noopener" className="inline-flex">
                    <Button variant="soft" leftIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}>
                      Add to Google Calendar
                    </Button>
                  </a>
                  <a href={urls.webcal} className="inline-flex">
                    <Button variant="soft" leftIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}>
                      Open in Apple Calendar or Outlook
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void make()}
                  loading={pending}
                  leftIcon={status.data.active ? <RefreshCw aria-hidden="true" className="h-4 w-4" /> : <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />}
                >
                  {status.data.active ? 'Make a new address' : 'Get my calendar address'}
                </Button>
                {status.data.active && (
                  <Button variant="danger-ghost" onClick={() => setConfirmOff(true)} leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}>
                    Turn off
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => void off()}
        title="Turn off calendar sync?"
        description="Your calendar app will stop getting updates and the address will stop working."
        confirmLabel="Turn off"
        variant="danger"
        loading={pending}
      />
    </Card>
  );
}
