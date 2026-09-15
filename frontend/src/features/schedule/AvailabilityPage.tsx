import { PageHeader, Card } from '@/components/ui';

export default function AvailabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Availability Settings" description="Availability Settings feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Availability Settings is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
