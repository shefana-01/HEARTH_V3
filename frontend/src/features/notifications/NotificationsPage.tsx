import { PageHeader, Card } from '@/components/ui';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Notifications feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Notifications is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
