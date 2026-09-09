import { PageHeader, Card } from '@/components/ui';

export default function ReportUnavailabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Report Unavailability" description="Report Unavailability feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Report Unavailability is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
