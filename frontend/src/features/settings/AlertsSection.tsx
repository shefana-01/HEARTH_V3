import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { familyService } from '@/services/family/familyService';
import { isDemoMode } from '@/services/config';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { Badge, Card, CardHeader, ErrorState, PageSkeleton, Switch, useToast } from '@/components/ui';

export function AlertsSection() {
  const { toast } = useToast();
  const { refreshSession } = useAuth();
  const account = useAsync(() => familyService.getAccount(), []);
  const savePref = useMutation(familyService.updateAccount);
  const hasPhone = Boolean(account.data?.phone);

  const toggleWhatsapp = async (on: boolean) => {
    const saved = await savePref.run({ whatsappAlerts: on });
    if (saved) {
      account.setData(saved);
      await refreshSession();
      toast({ title: on ? 'WhatsApp preference saved' : 'WhatsApp alerts turned off', description: on ? 'We’ll use it as soon as alerts are connected.' : undefined });
    }
  };

  if (account.status === 'error') return <ErrorState message={account.error?.message} onRetry={account.reload} />;
  if (!account.data) return <PageSkeleton />;

  return (
    <Card as="section" aria-labelledby="alerts-heading">
      <CardHeader title={<span id="alerts-heading">Alerts & reminders</span>} icon={<Bell aria-hidden="true" className="h-5 w-5" />} />
      <div className="space-y-2 text-sm text-ink-muted">
        <p>Hearth reminds you 15 minutes before a task you asked to be reminded about, and an hour before an appointment.</p>
        {isDemoMode && <p>In the demo, reminders appear while Hearth is open in this tab.</p>}
        <p>
          Reminders and family updates arrive in your notifications.{' '}
          <Link to="/notifications" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
            View notifications
          </Link>
        </p>
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <Switch
          checked={Boolean(account.data.whatsappAlerts) && hasPhone}
          onChange={toggleWhatsapp}
          disabled={!hasPhone || savePref.pending}
          label={
            <span className="flex flex-wrap items-center gap-2">
              WhatsApp alerts <Badge tone="amber">Coming soon</Badge>
            </span>
          }
          description={
            hasPhone
              ? `Get task changes and clashes on ${account.data.phone}. This saves your preference only — messages are sent once Hearth’s notification service is connected.`
              : 'Add a phone number in Profile first. WhatsApp alerts are sent to it.'
          }
        />
      </div>
    </Card>
  );
}
