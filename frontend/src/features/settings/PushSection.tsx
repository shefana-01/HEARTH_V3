import { useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { pushService } from '@/services/notifications/pushService';
import { isDemoMode } from '@/services/config';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, Card, CardHeader, ErrorState, Skeleton, Switch, useToast } from '@/components/ui';

/** Push notifications on this phone or computer: on, off, and a test. */
export function PushSection() {
  const { toast } = useToast();
  const state = useAsync(() => pushService.getState(), []);
  const [pending, setPending] = useState(false);

  const toggle = async (on: boolean) => {
    setPending(true);
    try {
      if (on) await pushService.enable();
      else await pushService.disable();
      await state.reload();
      toast({ title: on ? 'Notifications are on for this device' : 'Notifications are off for this device' });
    } catch (e) {
      toast({ tone: 'error', title: on ? 'Couldn’t turn on notifications' : 'Couldn’t turn off notifications', description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(false);
    }
  };

  const test = async () => {
    const shown = await pushService.showLocal('Hearth', 'Notifications work on this device.');
    if (!shown) toast({ tone: 'error', title: 'Couldn’t show a notification', description: 'Turn notifications on first.' });
  };

  const s = state.data;
  return (
    <Card as="section" aria-labelledby="push-heading">
      <CardHeader title={<span id="push-heading">Notifications on this device</span>} icon={<Smartphone aria-hidden="true" className="h-5 w-5" />} />
      {state.status === 'error' ? (
        <ErrorState message={state.error?.message} onRetry={state.reload} />
      ) : !s ? (
        <Skeleton className="h-16" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {isDemoMode
              ? 'In the demo, reminders appear as notifications on this device while Hearth is open.'
              : 'Get reminders, handover requests and family news on this phone or computer, even when Hearth is closed. Turn it on separately on each device.'}
          </p>
          {!s.supported ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Badge tone="amber">Not supported here</Badge> This browser can’t receive notifications. On an iPhone, add Hearth to the Home Screen and open it from there.
            </p>
          ) : !s.available ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Badge tone="neutral">Off on this Hearth</Badge> Push notifications haven’t been set up on the server yet.
            </p>
          ) : (
            <>
              <Switch
                checked={s.enabled}
                disabled={pending || s.permission === 'denied'}
                onChange={(on) => void toggle(on)}
                label="Notifications on this device"
                description={
                  s.permission === 'denied'
                    ? 'Notifications are blocked for Hearth in this browser. Allow them in the site settings first.'
                    : !isDemoMode && s.devices > 0
                      ? `On for ${s.devices} ${s.devices === 1 ? 'device' : 'devices'} of yours.`
                      : undefined
                }
              />
              {s.enabled && (
                <Button size="sm" variant="secondary" onClick={() => void test()} leftIcon={<BellRing aria-hidden="true" className="h-4 w-4" />}>
                  Send a test notification
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
