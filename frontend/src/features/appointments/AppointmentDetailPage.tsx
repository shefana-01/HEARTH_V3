import { PageHeader, Card } from '@/components/ui';

export default function AppointmentDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Appointment Overview" description="Appointment Overview feature." />
      <Card className="p-8 text-center text-ink-muted">
        <p className="text-sm font-medium">Appointment Overview is scheduled for Phase 3 implementation.</p>
      </Card>
    </div>
  );
}
